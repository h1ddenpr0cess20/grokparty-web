import { describe, expect, it } from 'vitest';
import { stripCitationArtifacts } from './conversationEngine';

describe('stripCitationArtifacts', () => {
  it('removes standalone bracketed numbers', () => {
    expect(stripCitationArtifacts('Yo [1] crew')).toBe('Yo crew');
  });

  it('removes bracketed numbers with urls', () => {
    expect(stripCitationArtifacts('See [2](https://example.com) now')).toBe('See now');
  });

  it('removes markdown image-style citations', () => {
    expect(stripCitationArtifacts('Look here!\n![3](https://foo.bar)\nNext line')).toBe('Look here!\n\nNext line');
  });

  it('keeps regular urls intact', () => {
    expect(stripCitationArtifacts('Visit https://example.com for more info')).toBe(
      'Visit https://example.com for more info',
    );
  });

  it('preserves punctuation adjacent to inline citations', () => {
    expect(stripCitationArtifacts('Shout! [5](https://foo) now!')).toBe('Shout! now!');
  });

  it('retains trailing text after removing citations', () => {
    expect(stripCitationArtifacts('NVDA rallied [7](https://news) today in after-hours')).toBe(
      'NVDA rallied today in after-hours',
    );
  });

  it('removes citation definitions without touching following lines', () => {
    const input = '[3]: https://source\nStill here';
    expect(stripCitationArtifacts(input)).toBe('Still here');
  });

  it('preserves indentation inside fenced code blocks', () => {
    const input = '```js\nfunction test() {\n  console.log("ok");\n}\n```';
    expect(stripCitationArtifacts(input)).toBe(input);
  });

  it('preserves inline code spacing', () => {
    const input = 'Use `npm  run build` after setup [1]';
    expect(stripCitationArtifacts(input)).toBe('Use `npm  run build` after setup');
  });
});
