import { RomlFile } from '../file/RomlFile';

describe('RomlMetadata.checksum is a real digest of the input', () => {
  // PR 10a: previously `checksum` was the literal string `'simplified'`
  // (or `'error'` on the failure path). It's now a stable hex digest of
  // the raw input, computed via `RomlFile.getChecksum()`.

  it('returns an 8-character lower-case hex string', () => {
    const file = new RomlFile('~ROML~\nname="Robert"');
    const meta = file.getMetadata();
    expect(meta?.checksum).toMatch(/^[0-9a-f]{8}$/);
  });

  it('is no longer the placeholder string `simplified`', () => {
    const file = new RomlFile('~ROML~\nname="Robert"');
    const meta = file.getMetadata();
    expect(meta?.checksum).not.toBe('simplified');
  });

  it('is stable for identical input', () => {
    const a = new RomlFile('~ROML~\nname="Robert"').getMetadata();
    const b = new RomlFile('~ROML~\nname="Robert"').getMetadata();
    expect(a?.checksum).toBe(b?.checksum);
  });

  it('differs for different input', () => {
    const a = new RomlFile('~ROML~\nname="Robert"').getMetadata();
    const b = new RomlFile('~ROML~\nname="Alice"').getMetadata();
    expect(a?.checksum).not.toBe(b?.checksum);
  });

  it('matches RomlFile.getChecksum() for the same input', () => {
    const content = '~ROML~\nfoo:7\nbar="x"';
    const file = new RomlFile(content);
    const meta = file.getMetadata();
    expect(meta?.checksum).toBe(file.getChecksum());
  });

  it('also returns a real digest on the error path (missing header)', () => {
    // PR 7 made the error-path `data` null; the metadata still exists.
    // The checksum should be a real digest of the input string, not
    // the literal placeholder `'error'`.
    const file = new RomlFile('not roml');
    const result = file.parse();
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.metadata.checksum).toMatch(/^[0-9a-f]{8}$/);
    expect(result.metadata.checksum).not.toBe('error');
  });
});
