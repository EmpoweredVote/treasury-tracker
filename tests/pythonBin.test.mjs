/**
 * Python interpreter resolution.
 *
 * On this machine `python`, `python3` and `py` on PATH are all Microsoft Store
 * ALIAS STUBS. They exist, they are executable, and they do not run Python —
 * they print "Python was not found; run without arguments to install from the
 * Microsoft Store". The real interpreter is a per-user install at
 * %LOCALAPPDATA%\Python\pythoncore-3.14-64, which PATH does not reach.
 *
 * So "the command exists" is not evidence that it works, and a resolver that
 * trusts the name picks the stub every time. These tests pin the rejection.
 */

import { describe, it, expect } from 'vitest';
import { pickInterpreter, STORE_STUB_MARKER } from '../scripts/lib/pythonBin.mjs';

/** Build a fake prober from a map of command -> what running `--version` does. */
const prober = (responses) => (cmd) => {
  const r = responses[cmd];
  if (r === undefined) throw new Error(`ENOENT: ${cmd}`);
  if (r instanceof Error) throw r;
  return r;
};

describe('pickInterpreter', () => {
  it('takes the first candidate that reports a real version', () => {
    const probe = prober({ python: 'Python 3.14.3\n', other: 'Python 3.11.0\n' });
    expect(pickInterpreter(['python', 'other'], probe)).toBe('python');
  });

  it('rejects a Microsoft Store stub even though the command exists', () => {
    // The bug this module exists for: the stub is present and executable.
    const probe = prober({
      python: `Python was not found; run without arguments to install from the ${STORE_STUB_MARKER}`,
      real: 'Python 3.14.3\n',
    });
    expect(pickInterpreter(['python', 'real'], probe)).toBe('real');
  });

  it('skips a candidate that does not exist at all', () => {
    const probe = prober({ real: 'Python 3.14.3\n' });
    expect(pickInterpreter(['absent', 'real'], probe)).toBe('real');
  });

  it('skips a candidate that runs but is not Python', () => {
    const probe = prober({ python: 'v22.1.0\n', real: 'Python 3.14.3\n' });
    expect(pickInterpreter(['python', 'real'], probe)).toBe('real');
  });

  it('throws a message naming what it tried when nothing works', () => {
    const probe = prober({ python: `install from the ${STORE_STUB_MARKER}` });
    expect(() => pickInterpreter(['python', 'absent'], probe)).toThrow(/python.*absent/s);
  });
});
