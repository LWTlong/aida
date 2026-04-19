import * as readline from 'node:readline';
import * as readlinePromises from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { cyan, dim, green, yellow } from './display.js';

export interface PromptOption<T extends string> {
  label: string
  value: T
  hint?: string
}

interface MultiSelectOptions {
  required?: boolean
}

interface SingleSelectOptions {
  allowSkip?: boolean
}

function isInteractiveTty(): boolean {
  return Boolean(stdin.isTTY && stdout.isTTY);
}

function restoreInputState(previousRawMode: boolean | undefined, wasPaused: boolean): void {
  stdin.setRawMode?.(previousRawMode ?? false);
  if (wasPaused) stdin.pause();
}

function clearRenderedLines(lines: number): void {
  for (let i = 0; i < lines; i++) {
    stdout.write('\x1b[2K');
    if (i < lines - 1) stdout.write('\x1b[1A');
  }
  if (lines > 0) stdout.write('\r');
}

function renderOptions<T extends string>(
  title: string,
  options: PromptOption<T>[],
  cursor: number,
  selected: Set<T>,
  multi: boolean,
  allowSkip = false,
): number {
  const lines: string[] = [];
  lines.push(`\n  ${title}`);
  lines.push(dim(`  ${multi ? 'Use Up/Down to move, Space to toggle, Enter to confirm.' : 'Use Up/Down to move, Enter to confirm.'}${allowSkip ? ' Enter on empty selection to skip.' : ''}`));
  lines.push('');

  options.forEach((option, index) => {
    const pointer = index === cursor ? cyan('>') : ' ';
    const marker = multi ? (selected.has(option.value) ? green('[x]') : '[ ]') : index === cursor ? green('[*]') : '[ ]';
    const hint = option.hint ? dim(` - ${option.hint}`) : '';
    lines.push(`  ${pointer} ${marker} ${option.label}${hint}`);
  });

  lines.push('');
  stdout.write(lines.join('\n'));
  return lines.length;
}

async function promptLine(question: string): Promise<string> {
  const rl = readlinePromises.createInterface({ input: stdin, output: stdout });
  const answer = (await rl.question(question)).trim();
  rl.close();
  return answer;
}

async function promptMultiFallback<T extends string>(
  title: string,
  options: PromptOption<T>[],
  opts: MultiSelectOptions = {},
): Promise<T[]> {
  console.log(`\n  ${title}\n`);
  options.forEach((option, index) => {
    console.log(`    ${index + 1}) ${option.label}${option.hint ? ` - ${option.hint}` : ''}`);
  });
  console.log('');
  console.log(dim('  Non-interactive terminal detected. Enter comma-separated numbers, or press Enter to accept none.\n'));

  while (true) {
    const answer = await promptLine('  > ');
    if (!answer) {
      if (!opts.required) return [];
      console.log(yellow('  Please select at least one option.'));
      continue;
    }

    const indices = answer
      .split(',')
      .map((item) => parseInt(item.trim(), 10))
      .filter((num) => num >= 1 && num <= options.length);
    const selected = [...new Set(indices.map((num) => options[num - 1].value))];
    if (selected.length > 0) return selected;
    if (!opts.required) return [];
    console.log(yellow('  Please select at least one option.'));
  }
}

async function promptSingleFallback<T extends string>(
  title: string,
  options: PromptOption<T>[],
  opts: SingleSelectOptions = {},
): Promise<T | null> {
  console.log(`\n  ${title}\n`);
  options.forEach((option, index) => {
    console.log(`    ${index + 1}) ${option.label}${option.hint ? ` - ${option.hint}` : ''}`);
  });
  console.log('');
  if (opts.allowSkip) {
    console.log(dim('  Non-interactive terminal detected. Press Enter to skip.\n'));
  }

  while (true) {
    const answer = await promptLine('  > ');
    if (!answer && opts.allowSkip) return null;
    const index = parseInt(answer, 10);
    if (index >= 1 && index <= options.length) return options[index - 1].value;
    console.log(yellow(`  Please enter a number between 1 and ${options.length}${opts.allowSkip ? ', or press Enter to skip' : ''}.`));
  }
}

export async function promptMultiSelect<T extends string>(
  title: string,
  options: PromptOption<T>[],
  opts: MultiSelectOptions = {},
): Promise<T[]> {
  if (options.length === 0) return [];
  if (!isInteractiveTty()) {
    return promptMultiFallback(title, options, opts);
  }

  readline.emitKeypressEvents(stdin);
  const previousRawMode = stdin.isRaw;
  const wasPaused = stdin.isPaused();
  stdin.setRawMode?.(true);
  stdin.resume();

  let cursor = 0;
  const selected = new Set<T>();
  let renderedLines = renderOptions(title, options, cursor, selected, true);

  try {
    return await new Promise<T[]>((resolve, reject) => {
      const onKeypress = (_str: string, key: readline.Key) => {
        if (key.ctrl && key.name === 'c') {
          cleanup();
          reject(new Error('Prompt cancelled'));
          return;
        }

        if (key.name === 'up') cursor = cursor === 0 ? options.length - 1 : cursor - 1;
        if (key.name === 'down') cursor = cursor === options.length - 1 ? 0 : cursor + 1;
        if (key.name === 'space') {
          const value = options[cursor].value;
          if (selected.has(value)) selected.delete(value);
          else selected.add(value);
        }

        if (key.name === 'return') {
          if (!opts.required || selected.size > 0) {
            cleanup();
            resolve(options.filter((option) => selected.has(option.value)).map((option) => option.value));
            return;
          }
        }

        rerender();
      };

      const rerender = () => {
        clearRenderedLines(renderedLines);
        renderedLines = renderOptions(title, options, cursor, selected, true);
      };

      const cleanup = () => {
        stdin.off('keypress', onKeypress);
        restoreInputState(previousRawMode, wasPaused);
        clearRenderedLines(renderedLines);
      };

      stdin.on('keypress', onKeypress);
    });
  } finally {
    restoreInputState(previousRawMode, wasPaused);
  }
}

export async function promptSingleSelect<T extends string>(
  title: string,
  options: PromptOption<T>[],
  opts: SingleSelectOptions = {},
): Promise<T | null> {
  if (options.length === 0) return null;
  if (!isInteractiveTty()) {
    return promptSingleFallback(title, options, opts);
  }

  readline.emitKeypressEvents(stdin);
  const previousRawMode = stdin.isRaw;
  const wasPaused = stdin.isPaused();
  stdin.setRawMode?.(true);
  stdin.resume();

  let cursor = 0;
  let renderedLines = renderOptions(title, options, cursor, new Set<T>(), false, opts.allowSkip);

  try {
    return await new Promise<T | null>((resolve, reject) => {
      const onKeypress = (_str: string, key: readline.Key) => {
        if (key.ctrl && key.name === 'c') {
          cleanup();
          reject(new Error('Prompt cancelled'));
          return;
        }

        if (key.name === 'up') cursor = cursor === 0 ? options.length - 1 : cursor - 1;
        if (key.name === 'down') cursor = cursor === options.length - 1 ? 0 : cursor + 1;

        if (key.name === 'return') {
          cleanup();
          resolve(options[cursor]?.value ?? (opts.allowSkip ? null : options[0]?.value ?? null));
          return;
        }

        if (opts.allowSkip && key.name === 'escape') {
          cleanup();
          resolve(null);
          return;
        }

        rerender();
      };

      const rerender = () => {
        clearRenderedLines(renderedLines);
        renderedLines = renderOptions(title, options, cursor, new Set<T>(), false, opts.allowSkip);
      };

      const cleanup = () => {
        stdin.off('keypress', onKeypress);
        restoreInputState(previousRawMode, wasPaused);
        clearRenderedLines(renderedLines);
      };

      stdin.on('keypress', onKeypress);
    });
  } finally {
    restoreInputState(previousRawMode, wasPaused);
  }
}
