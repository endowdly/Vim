import { VimState } from '../../state/vimState';
import { PairMatcher } from './../../common/matching/matcher';
import { Position } from './../../common/motion/position';
import { Range } from './../../common/motion/range';
import { configuration } from './../../configuration/configuration';
import { ModeName } from './../../mode/mode';
import { TextEditor } from './../../textEditor';
import { RegisterAction } from './../base';
import { BaseCommand } from './../commands/actions';
import { BaseMovement } from './../motion';
import {
  IMovement,
  MoveABacktick,
  MoveACaret,
  MoveACurlyBrace,
  MoveADoubleQuotes,
  MoveAParentheses,
  MoveAroundTag,
  MoveASingleQuotes,
  MoveASquareBracket,
  MoveInsideCharacter,
  MoveInsideTag,
  MoveQuoteMatch,
} from './../motion';
import { ChangeOperator, DeleteOperator, YankOperator } from './../operator';
import {
  SelectInnerBigWord,
  SelectInnerParagraph,
  SelectInnerSentence,
  SelectInnerWord,
  TextObjectMovement,
} from './../textobject';

// Because of the way `coerce` works, I feel like I'm going to have to copy the
// methods used in coerce in order to register the actions correctly.
// So here goes some blantant copying!
// In addition, there are some great coercive methods already implemented in TypeScript,
// so time to add and change those to fit the extensions framework. I'll mark and credit them
// when we get there.
// Todo: Don't forget to mark and credit the `change-case` guy

// These next two actions should be identical to `coerce.ts`.
@RegisterAction
class CommandCoerceAddTarget extends BaseCommand {
  modes = [ModeName.CoerceInputMode];
  keys = [
    ['('],
    [')'],
    ['{'],
    ['}'],
    ['['],
    [']'],
    ['<'],
    ['>'],
    ["'"],
    ['"'],
    ['`'],
    ['t'],
    ['w'],
    ['W'],
    ['s'],
    ['p'],
    ['b'],
    ['B'],
    ['r'],
    ['a'],
  ];
  isCompleteAction = false;
  runsOnceForEveryCursor() {
    return false;
  }

  public async exec(position: Position, vimState: VimState): Promise<VimState> {
    if (!vimState.coerce) {
      return vimState;
    }

    vimState.coerce.target = this.keysPressed[this.keysPressed.length - 1];

    if (vimState.coerce.target === 'b') {
      vimState.coerce.target = ')';
    }

    if (vimState.coerce.target === 'B') {
      vimState.coerce.target = '}';
    }

    if (vimState.coerce.target === 'r') {
      vimState.coerce.target = ']';
    }

    if (vimState.coerce.target === 'a') {
      vimState.coerce.target = '>';
    }

    // It's possible we're already done, e.g. dst
    // Todo: Implement CommandCoerceAddtoReplacement
    // if (await CommandCoerceAddToReplacement.TryToExecuteCoerce(vimState, position)) {
    //   this.isCompleteAction = true;
    // }

    return vimState;
  }

  public doesActionApply(vimState: VimState, keysPressed: string[]): boolean {
    return (
      super.doesActionApply(vimState, keysPressed) &&
      !!(
        vimState.coerce &&
        vimState.coerce.active &&
        !vimState.coerce.target &&
        !vimState.coerce.range
      )
    );
  }

  public couldActionApply(vimState: VimState, keysPressed: string[]): boolean {
    return (
      super.doesActionApply(vimState, keysPressed) &&
      !!(
        vimState.coerce &&
        vimState.coerce.active &&
        !vimState.coerce.target &&
        !vimState.coerce.range
      )
    );
  }
}

// > You'd need to refactor our keybinding handling to "give up" keystrokes if it
// > can't find a match.
// Man, I'd love to take a crack at this. Maybe later, because that sounds like a
// lot of work and I am not proficient in TypeScript yet. So for now, we'll emulate
// the repeat structure.

@RegisterAction
class CommandCoerceModeRepeat extends BaseMovement {
  modes = [ModeName.Normal];
  keys = ['r'];   // `coerce.vim` user `cr`.
  isCompleteAction = false;
  runsOnceForEveryCursor() {
    return false;
  }

  public async execAction(position: Position, vimState: VimState): Promise<IMovement> {
    return {
      start: position.getLineBeginRespectingIndent(),
      stop: position
        .getLineEnd()
        .getLastWordEnd()
        .getRight(),
    };
  }

  public doesActionApply(vimState: VimState, keysPressed: string[]): boolean {
    return super.doesActionApply(vimState, keysPressed) && vimState.coerce !== undefined;
  }
}

@RegisterAction
class CommandCoerceModeStart extends BaseCommand {
  modes = [ModeName.Normal];
  keys = ['r']; // `cr*`
  isCompleteAction = false;
  runsOnceForEveryCursor() {
    return false;
  }

  public async exec(position: Position, vimState: VimState): Promise<VimState> {
    // Only execute the action if the configuration is set
    if (!configuration.coerce) {
      return vimState;
    }

    const operator = vimState.recordedState.operator;
    let operatorString: 'change' | undefined;  // can only be change

    if (operator instanceof ChangeOperator) {
      operatorString = 'change';
    }

    if (!operatorString) {
      return vimState;
    }

    // Start to record the keys to store for playback of coerce using dot
    vimState.recordedState.coerceKeys.push(vimState.keyHistory[vimState.keyHistory.length - 2]);
    vimState.recordedState.coerceKeys.push('s');
    vimState.recordedState.coerceKeyIndexStart = vimState.keyHistory.length;

    vimState.coerce = {
      active: true,
      target: undefined,
      operator: operatorString,
      replacement: undefined,
      range: undefined,
      isVisualLine: false,
    };

    // Since the operatorString will never equal yank...
    vimState.currentMode = ModeName.CoerceInputMode;

    return vimState;
  }

  public doesActionApply(vimState: VimState, keysPressed: string[]): boolean {
    const hasSomeOperator = !!vimState.recordedState.operator;

    return super.doesActionApply(vimState, keysPressed) && hasSomeOperator;
  }

  public couldActionApply(vimState: VimState, keysPressed: string[]): boolean {
    const hasSomeOperator = !!vimState.recordedState.operator;

    return super.doesActionApply(vimState, keysPressed) && hasSomeOperator;
  }
}