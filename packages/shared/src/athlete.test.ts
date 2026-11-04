import { describe, expect, it } from 'vitest';
import { achievementSchema, athleteCompletion, athleteProfileSchema } from './athlete.js';

const empty = {
  sport: null,
  position: '',
  city: '',
  province: null,
  club: '',
  school: '',
  experienceYears: null,
  bio: '',
  skills: [],
  interests: [],
};

describe('athleteProfileSchema', () => {
  it('turns blank text into null', () => {
    const r = athleteProfileSchema.parse(empty);
    expect(r.position).toBeNull();
    expect(r.bio).toBeNull();
  });
  it('accepts a full profile from the fixed lists', () => {
    const r = athleteProfileSchema.safeParse({
      ...empty,
      sport: 'Football',
      position: 'Midfielder',
      province: 'Gauteng',
      experienceYears: 4,
      skills: ['Teamwork', 'Leadership'],
      interests: ['Football', 'Sports Science'],
    });
    expect(r.success).toBe(true);
  });
  it('rejects values outside the fixed lists', () => {
    expect(athleteProfileSchema.safeParse({ ...empty, sport: 'Quidditch' }).success).toBe(false);
    expect(athleteProfileSchema.safeParse({ ...empty, skills: ['Juggling'] }).success).toBe(false);
    expect(athleteProfileSchema.safeParse({ ...empty, province: 'Atlantis' }).success).toBe(false);
  });
  it('rejects duplicates and bad numbers', () => {
    expect(athleteProfileSchema.safeParse({ ...empty, skills: ['Teamwork', 'Teamwork'] }).success).toBe(
      false,
    );
    expect(athleteProfileSchema.safeParse({ ...empty, experienceYears: -1 }).success).toBe(false);
    expect(athleteProfileSchema.safeParse({ ...empty, experienceYears: 2.5 }).success).toBe(false);
  });
});

describe('achievementSchema', () => {
  it('accepts a valid achievement', () => {
    expect(
      achievementSchema.safeParse({
        title: 'District Champions',
        year: 2025,
        organisation: 'Soweto FC',
        detail: '',
      }).success,
    ).toBe(true);
  });
  it('rejects future years and empty titles', () => {
    const next = new Date().getFullYear() + 1;
    expect(
      achievementSchema.safeParse({ title: 'X', year: 2025, organisation: '', detail: '' }).success,
    ).toBe(false);
    expect(
      achievementSchema.safeParse({ title: 'Champs', year: next, organisation: '', detail: '' }).success,
    ).toBe(false);
  });
});

describe('athleteCompletion', () => {
  it('is 0% for an empty profile', () => {
    expect(athleteCompletion(null, 0).percent).toBe(0);
  });
  it('is 100% when every item is done', () => {
    const r = athleteCompletion(
      {
        sport: 'Football',
        position: 'Midfielder',
        province: 'Gauteng',
        bio: 'Passionate footballer who trains daily.',
        club: 'Soweto FC',
        skills: ['Teamwork'],
        interests: ['Football'],
      },
      1,
    );
    expect(r.percent).toBe(100);
    expect(r.items.every((i) => i.done)).toBe(true);
  });
  it('counts partial progress', () => {
    expect(athleteCompletion({ sport: 'Football', position: 'Wing', province: 'Gauteng' }, 0).percent).toBe(
      17,
    );
  });
});
