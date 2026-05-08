import { z } from 'zod';
import { Person } from '../types/person';

const dateLike = z.date().optional();

const today = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const personFormSchema = z
  .object({
    firstName: z.string().min(1, 'First name is required').max(100),
    middleName: z.string().max(100).optional().or(z.literal('')),
    lastName: z.string().max(100).optional().or(z.literal('')),
    preferredName: z.string().max(100).optional().or(z.literal('')),

    age: z
      .number()
      .min(0, 'Age must be 0 or more')
      .max(150, 'Age must be 150 or less')
      .optional(),

    gender: z.enum(['male', 'female', 'non-binary', 'other', 'unknown']),
    vitalStatus: z.enum(['alive', 'deceased', 'unknown']),

    dateOfBirth: dateLike,
    dateOfDeath: dateLike,

    livingSituation: z.string().optional().or(z.literal('')),
    currentResidence: z.string().optional().or(z.literal('')),
    placeOfBirth: z.string().optional().or(z.literal('')),
    mobNation: z.string().optional().or(z.literal('')),
    languageGroup: z.string().optional().or(z.literal('')),
    indigenousHeritage: z.string().optional().or(z.literal('')),

    tribalAffiliation: z.array(z.string()),
    culturalIdentity: z.array(z.string()),
    riskIndicators: z.array(z.string()),
    medicalConditions: z.array(z.string()),
    mentalHealthConditions: z.array(z.string()),

    substanceUse: z.array(
      z.object({
        type: z.string().min(1),
        status: z.enum(['current', 'past', 'never']),
        notes: z.string().optional(),
      })
    ),
    caseNotes: z.array(
      z.object({
        date: z.date(),
        note: z.string().min(1),
        author: z.string().min(1),
      })
    ),

    notes: z.string().optional().or(z.literal('')),
    occupation: z.string().optional().or(z.literal('')),
    education: z.string().optional().or(z.literal('')),

    isIndexPerson: z.boolean().optional(),
    pregnancyStatus: z
      .enum(['pregnancy', 'miscarriage', 'stillbirth', 'abortion'])
      .optional(),
  })
  .superRefine((data, ctx) => {
    const t = today();

    if (data.dateOfBirth && data.dateOfBirth > t) {
      ctx.addIssue({
        code: 'custom',
        message: 'Date of birth cannot be in the future',
        path: ['dateOfBirth'],
      });
    }

    if (data.dateOfDeath && data.dateOfDeath > t) {
      ctx.addIssue({
        code: 'custom',
        message: 'Date of death cannot be in the future',
        path: ['dateOfDeath'],
      });
    }

    if (
      data.dateOfBirth &&
      data.dateOfDeath &&
      data.dateOfDeath < data.dateOfBirth
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Date of death must be after date of birth',
        path: ['dateOfDeath'],
      });
    }

    if (data.vitalStatus !== 'deceased' && data.dateOfDeath) {
      ctx.addIssue({
        code: 'custom',
        message:
          'Date of death is set but vital status is not "deceased". Update vital status or clear the date.',
        path: ['dateOfDeath'],
      });
    }
  });

export type PersonFormValues = z.infer<typeof personFormSchema>;

export function personToForm(p: Person): PersonFormValues {
  return {
    firstName: p.firstName,
    middleName: p.middleName ?? '',
    lastName: p.lastName ?? '',
    preferredName: p.preferredName ?? '',
    age: p.age,
    gender: p.gender,
    vitalStatus: p.vitalStatus,
    dateOfBirth: p.dateOfBirth,
    dateOfDeath: p.dateOfDeath,
    livingSituation: p.livingSituation ?? '',
    currentResidence: p.currentResidence ?? '',
    placeOfBirth: p.placeOfBirth ?? '',
    mobNation: p.mobNation ?? '',
    languageGroup: p.languageGroup ?? '',
    indigenousHeritage: p.indigenousHeritage ?? '',
    tribalAffiliation: p.tribalAffiliation ?? [],
    culturalIdentity: p.culturalIdentity ?? [],
    riskIndicators: p.riskIndicators ?? [],
    medicalConditions: p.medicalConditions ?? [],
    mentalHealthConditions: p.mentalHealthConditions ?? [],
    substanceUse: p.substanceUse ?? [],
    caseNotes: p.caseNotes ?? [],
    notes: p.notes ?? '',
    occupation: p.occupation ?? '',
    education: p.education ?? '',
    isIndexPerson: p.isIndexPerson,
    pregnancyStatus: p.pregnancyStatus,
  };
}

export function formToPersonUpdates(
  values: PersonFormValues
): Partial<Person> {
  const blank = (s: string | undefined) => (s && s.length > 0 ? s : undefined);
  return {
    firstName: values.firstName,
    middleName: blank(values.middleName),
    lastName: values.lastName ?? '',
    preferredName: blank(values.preferredName),
    age: values.age,
    gender: values.gender,
    vitalStatus: values.vitalStatus,
    dateOfBirth: values.dateOfBirth,
    dateOfDeath: values.dateOfDeath,
    livingSituation: blank(values.livingSituation),
    currentResidence: blank(values.currentResidence),
    placeOfBirth: blank(values.placeOfBirth),
    mobNation: blank(values.mobNation),
    languageGroup: blank(values.languageGroup),
    indigenousHeritage: blank(values.indigenousHeritage),
    tribalAffiliation: values.tribalAffiliation,
    culturalIdentity: values.culturalIdentity,
    riskIndicators: values.riskIndicators,
    medicalConditions: values.medicalConditions,
    mentalHealthConditions: values.mentalHealthConditions,
    substanceUse: values.substanceUse,
    caseNotes: values.caseNotes,
    notes: blank(values.notes),
    occupation: blank(values.occupation),
    education: blank(values.education),
    isIndexPerson: values.isIndexPerson || undefined,
    pregnancyStatus: values.pregnancyStatus,
    updatedAt: new Date(),
  };
}
