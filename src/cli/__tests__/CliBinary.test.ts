import { spawnSync } from 'child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// These tests spawn the built CLI binary, so they require `npm run build`
// to have produced `dist/cli.js`. The `prepare` npm script handles that on
// `npm install`, and the local Makefile chains build before tests.

const cliPath = join(process.cwd(), 'dist', 'cli.js');
const pkgPath = join(process.cwd(), 'package.json');

function run(args: string[], input?: string) {
  return spawnSync('node', [cliPath, ...args], {
    input,
    encoding: 'utf-8',
  });
}

describe('CLI binary integration', () => {
  describe('--version', () => {
    it('prints the package version and exits 0', () => {
      const expected = JSON.parse(readFileSync(pkgPath, 'utf-8')).version;
      const result = run(['--version']);
      expect(result.status).toBe(0);
      expect(result.stdout.trim()).toBe(expected);
    });

    it('-v is an alias', () => {
      const result = run(['-v']);
      expect(result.status).toBe(0);
      expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
    });
  });

  describe('positional file argument', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = mkdtempSync(join(tmpdir(), 'roml-cli-test-'));
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it('encode FILE reads from the file path', () => {
      const jsonPath = join(tmpDir, 'in.json');
      writeFileSync(jsonPath, '{"name":"Robert","age":30}');

      const result = run(['encode', jsonPath]);

      expect(result.status).toBe(0);
      expect(result.stdout).toMatch(/^~ROML~/);
      expect(result.stdout).toContain('Robert');
    });

    it('decode FILE reads from the file path', () => {
      const romlPath = join(tmpDir, 'in.roml');
      writeFileSync(romlPath, '~ROML~\nname="Robert"\nage:30');

      const result = run(['decode', romlPath]);

      expect(result.status).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed).toEqual({ name: 'Robert', age: 30 });
    });

    it('validate FILE reads from the file path', () => {
      const romlPath = join(tmpDir, 'in.roml');
      writeFileSync(romlPath, '~ROML~\nfoo:7');

      const result = run(['validate', romlPath]);

      expect(result.status).toBe(0);
      expect(result.stdout).toMatch(/valid/i);
    });

    it('exits 1 with a clear error when the file does not exist', () => {
      const result = run(['encode', join(tmpDir, 'nope.json')]);

      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/Cannot read file/);
    });
  });

  describe('help', () => {
    it('lists the validate command and the file argument syntax', () => {
      const result = run(['help']);
      expect(result.status).toBe(0);
      expect(result.stdout).toMatch(/validate/);
      expect(result.stdout).toMatch(/\[FILE\]/);
    });
  });
});
