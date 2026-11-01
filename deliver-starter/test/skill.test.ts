import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { deliverSkillCandidates, findDeliverSkill, INSTALL_COMMAND } from '../lib/skill.ts';

// The same cases pin the copies of this lookup in deliver-starter and deliver-log.
describe('deliver skill lookup', () => {
  // join() turns the posix literals into the separators of the platform, like the lookup does.
  const order = [
    '/repo/.claude/skills/deliver',
    '/repo/.agents/skills/deliver',
    '/home/u/.claude/skills/deliver',
    '/home/u/.agents/skills/deliver',
  ].map((dir) => join(dir));

  it('looks in the repository first, then in the home directory, .claude before .agents', () => {
    expect(deliverSkillCandidates('/repo', '/home/u')).toEqual(order);
  });

  it.each(order.map((dir, index) => [dir, order.slice(index)] as const))(
    'finds %s when it and every later candidate exist',
    (expected, present) => {
      expect(findDeliverSkill('/repo', '/home/u', (dir) => present.includes(dir))).toBe(expected);
    },
  );

  it('looks only in the home directory outside a repository', () => {
    expect(deliverSkillCandidates(null, '/home/u')).toEqual(order.slice(2));
    expect(findDeliverSkill(null, '/home/u', (dir) => dir === order[0])).toBeNull();
  });

  it('returns null when the skill is not installed', () => {
    expect(findDeliverSkill('/repo', '/home/u', () => false)).toBeNull();
  });

  it('names the install command', () => {
    expect(INSTALL_COMMAND).toBe('npx skills add GravionLabs/skills --skill deliver');
  });
});
