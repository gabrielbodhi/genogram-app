'use client';

import React, { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useGenogramStore } from '@/lib/store/genogramStore';
import { Person } from '@/lib/types/person';
import { Relationship } from '@/lib/types/relationship';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Venus, Mars, CircleDot, Pencil, Trash2, Star } from 'lucide-react';
import ChipInput from '@/components/forms/ChipInput';
import CaseNoteList from '@/components/forms/CaseNoteList';
import SubstanceUseList from '@/components/forms/SubstanceUseList';
import {
  PersonFormValues,
  personFormSchema,
  personToForm,
  formToPersonUpdates,
} from '@/lib/forms/personSchema';

const PARENT_TYPES: ReadonlyArray<Relationship['type']> = [
  'biological-parent',
  'adoptive-parent',
  'foster-parent',
  'step-parent',
  'guardian',
];

const SIBLING_TYPES: ReadonlyArray<Relationship['type']> = [
  'sibling',
  'half-sibling',
  'step-sibling',
];

function genderIcon(gender: Person['gender']) {
  switch (gender) {
    case 'female':
      return <Venus className="h-4 w-4 text-pink-500" />;
    case 'male':
      return <Mars className="h-4 w-4 text-blue-500" />;
    default:
      return <CircleDot className="h-4 w-4 text-purple-500" />;
  }
}

function dateInputValue(d?: Date | string) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toISOString().slice(0, 10);
}

function ageFromDob(dob?: Date) {
  if (!dob) return undefined;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age -= 1;
  return age >= 0 ? age : undefined;
}

interface PersonLinkProps {
  person: Person;
  onSelect: (id: string) => void;
}

function PersonLink({ person, onSelect }: PersonLinkProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(person.id)}
      className="text-foreground underline-offset-2 hover:underline"
    >
      {person.firstName} {person.lastName}
      {person.age != null && (
        <span className="ml-1 text-muted-foreground">({person.age})</span>
      )}
    </button>
  );
}

export default function InfoPanel() {
  const {
    people,
    relationships,
    selectedPersonId,
    updatePerson,
    deletePerson,
    setSelectedPerson,
  } = useGenogramStore();

  const selectedPerson = useMemo(
    () => people.find((p) => p.id === selectedPersonId) || null,
    [people, selectedPersonId]
  );

  const form = useForm<PersonFormValues>({
    resolver: zodResolver(personFormSchema),
    mode: 'onBlur',
    defaultValues: selectedPerson
      ? personToForm(selectedPerson)
      : {
          firstName: '',
          middleName: '',
          lastName: '',
          preferredName: '',
          gender: 'unknown',
          vitalStatus: 'alive',
          livingSituation: '',
          currentResidence: '',
          placeOfBirth: '',
          mobNation: '',
          languageGroup: '',
          indigenousHeritage: '',
          notes: '',
          occupation: '',
          education: '',
          tribalAffiliation: [],
          culturalIdentity: [],
          riskIndicators: [],
          medicalConditions: [],
          mentalHealthConditions: [],
          substanceUse: [],
          caseNotes: [],
        },
  });

  const [isEditing, setIsEditing] = React.useState(false);

  // When the selected person changes, reset form values to that person's data.
  useEffect(() => {
    if (selectedPerson) {
      form.reset(personToForm(selectedPerson));
    }
    setIsEditing(false);
  }, [selectedPerson, form]);

  // Derive family members from relationships
  const { mother, father, primaryCarer, siblings, partners } = useMemo(() => {
    if (!selectedPerson) {
      return {
        mother: null,
        father: null,
        primaryCarer: null,
        siblings: [] as Person[],
        partners: [] as Person[],
      };
    }

    const relsForPerson = relationships.filter(
      (r) =>
        r.person1Id === selectedPerson.id || r.person2Id === selectedPerson.id
    );

    const parentRels = relsForPerson.filter((r) =>
      PARENT_TYPES.includes(r.type)
    );

    const getOther = (r: Relationship) =>
      r.person1Id === selectedPerson.id ? r.person2Id : r.person1Id;

    const biologicalParents = parentRels
      .filter((r) => r.type === 'biological-parent')
      .map((r) => people.find((p) => p.id === getOther(r)))
      .filter((p): p is Person => Boolean(p));

    const mother = biologicalParents.find((p) => p.gender === 'female') ?? null;
    const father = biologicalParents.find((p) => p.gender === 'male') ?? null;

    const carerRel =
      parentRels.find((r) => r.type === 'guardian') ??
      parentRels.find((r) => r.type === 'step-parent') ??
      parentRels.find((r) => r.type === 'adoptive-parent') ??
      parentRels.find((r) => r.type === 'foster-parent') ??
      null;
    const primaryCarer = carerRel
      ? people.find((p) => p.id === getOther(carerRel)) ?? null
      : null;

    const siblingRels = relsForPerson.filter((r) =>
      SIBLING_TYPES.includes(r.type)
    );
    const siblings = siblingRels
      .map((r) => people.find((p) => p.id === getOther(r)))
      .filter((p): p is Person => Boolean(p));

    const partnerRels = relsForPerson.filter((r) =>
      ['spouse', 'partner', 'divorced', 'separated'].includes(r.type)
    );
    const partners = partnerRels
      .map((r) => people.find((p) => p.id === getOther(r)))
      .filter((p): p is Person => Boolean(p));

    return { mother, father, primaryCarer, siblings, partners };
  }, [people, relationships, selectedPerson]);

  if (!selectedPerson) return null;

  const onSubmit = form.handleSubmit((values) => {
    updatePerson(selectedPerson.id, formToPersonUpdates(values));
    setIsEditing(false);
  });

  const handleDelete = () => {
    const ok = window.confirm(
      `Delete ${selectedPerson.firstName} ${selectedPerson.lastName || ''}? This will also remove their relationships.`
    );
    if (!ok) return;
    deletePerson(selectedPerson.id);
  };

  const watchedDob = form.watch('dateOfBirth') as Date | undefined;
  const watchedAge = form.watch('age');
  const computedAge = ageFromDob(
    watchedDob instanceof Date ? watchedDob : selectedPerson.dateOfBirth
  );
  const displayAge = watchedAge ?? computedAge;

  const fullName = [
    selectedPerson.firstName,
    selectedPerson.middleName,
    selectedPerson.lastName,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <aside className="pointer-events-auto fixed right-0 top-0 z-20 flex h-screen w-full max-w-xs sm:max-w-sm md:max-w-md lg:w-[380px] flex-col border-l bg-background/95 backdrop-blur">
      <Card className="h-full rounded-none border-0 shadow-lg">
        <CardHeader className="relative flex flex-col items-start justify-start gap-3 pb-4 pt-6 pr-6">
          <div className="absolute right-6 top-6 flex items-center gap-1">
            {isEditing ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    form.reset(personToForm(selectedPerson));
                    setIsEditing(false);
                  }}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={onSubmit}>
                  Save
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="mr-1 h-3 w-3" />
                Edit
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600 hover:text-red-700"
              onClick={handleDelete}
              title="Delete person"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-background bg-muted text-muted-foreground shadow-md">
            <User className="h-8 w-8" />
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{selectedPerson.id}</p>
            <CardTitle className="text-lg font-semibold">
              {fullName || 'Unnamed person'}
              {selectedPerson.isIndexPerson && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  <Star className="h-3 w-3" /> Index
                </span>
              )}
            </CardTitle>
            <CardDescription className="flex items-center gap-2 text-xs">
              {genderIcon(selectedPerson.gender)}
              <span className="capitalize">{selectedPerson.gender}</span>
              {displayAge != null && <span>· {displayAge} years</span>}
              <span>· {selectedPerson.vitalStatus}</span>
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="h-[calc(100vh-9rem)] overflow-y-auto pb-6">
          <form onSubmit={onSubmit}>
            <Tabs defaultValue="basics" className="w-full">
              <TabsList className="mb-4 grid w-full grid-cols-4">
                <TabsTrigger value="basics">Basics</TabsTrigger>
                <TabsTrigger value="cultural">Cultural</TabsTrigger>
                <TabsTrigger value="medical">Medical</TabsTrigger>
                <TabsTrigger value="family">Family</TabsTrigger>
              </TabsList>

              {/* BASICS */}
              <TabsContent value="basics" className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <Field label="First name" error={form.formState.errors.firstName?.message}>
                    {isEditing ? (
                      <Input {...form.register('firstName')} />
                    ) : (
                      <span className="text-sm">{selectedPerson.firstName}</span>
                    )}
                  </Field>
                  <Field label="Middle">
                    {isEditing ? (
                      <Input {...form.register('middleName')} />
                    ) : (
                      <span className="text-sm">
                        {selectedPerson.middleName || '—'}
                      </span>
                    )}
                  </Field>
                  <Field label="Last">
                    {isEditing ? (
                      <Input {...form.register('lastName')} />
                    ) : (
                      <span className="text-sm">
                        {selectedPerson.lastName || '—'}
                      </span>
                    )}
                  </Field>
                </div>

                <Field label="Preferred name">
                  {isEditing ? (
                    <Input {...form.register('preferredName')} />
                  ) : (
                    <span className="text-sm">
                      {selectedPerson.preferredName || (
                        <span className="text-muted-foreground">Not specified</span>
                      )}
                    </span>
                  )}
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Date of birth"
                    error={form.formState.errors.dateOfBirth?.message}
                  >
                    {isEditing ? (
                      <Controller
                        control={form.control}
                        name="dateOfBirth"
                        render={({ field }) => (
                          <Input
                            type="date"
                            value={dateInputValue(field.value as Date | undefined)}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value
                                  ? new Date(e.target.value)
                                  : undefined
                              )
                            }
                          />
                        )}
                      />
                    ) : (
                      <span className="text-sm">
                        {selectedPerson.dateOfBirth
                          ? dateInputValue(selectedPerson.dateOfBirth)
                          : 'Unknown'}
                      </span>
                    )}
                  </Field>
                  <Field label="Age" error={form.formState.errors.age?.message}>
                    {isEditing ? (
                      <Input
                        type="number"
                        {...form.register('age', {
                          setValueAs: (v) =>
                            v === '' || v == null ? undefined : Number(v),
                        })}
                        placeholder={
                          computedAge != null ? `${computedAge}` : ''
                        }
                      />
                    ) : (
                      <span className="text-sm">
                        {displayAge != null ? `${displayAge} years` : 'Unknown'}
                      </span>
                    )}
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Gender">
                    {isEditing ? (
                      <Controller
                        control={form.control}
                        name="gender"
                        render={({ field }) => (
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="female">Female</SelectItem>
                              <SelectItem value="male">Male</SelectItem>
                              <SelectItem value="non-binary">
                                Non-binary
                              </SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                              <SelectItem value="unknown">Unknown</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    ) : (
                      <span className="text-sm capitalize">
                        {selectedPerson.gender}
                      </span>
                    )}
                  </Field>
                  <Field label="Vital status">
                    {isEditing ? (
                      <Controller
                        control={form.control}
                        name="vitalStatus"
                        render={({ field }) => (
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="alive">Alive</SelectItem>
                              <SelectItem value="deceased">Deceased</SelectItem>
                              <SelectItem value="unknown">Unknown</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    ) : (
                      <span className="text-sm capitalize">
                        {selectedPerson.vitalStatus}
                      </span>
                    )}
                  </Field>
                </div>

                <Field
                  label="Date of death"
                  error={form.formState.errors.dateOfDeath?.message}
                >
                  {isEditing ? (
                    <Controller
                      control={form.control}
                      name="dateOfDeath"
                      render={({ field }) => (
                        <Input
                          type="date"
                          value={dateInputValue(field.value as Date | undefined)}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value ? new Date(e.target.value) : undefined
                            )
                          }
                        />
                      )}
                    />
                  ) : (
                    <span className="text-sm">
                      {selectedPerson.dateOfDeath
                        ? dateInputValue(selectedPerson.dateOfDeath)
                        : '—'}
                    </span>
                  )}
                </Field>

                <Field label="Current residence">
                  {isEditing ? (
                    <Input {...form.register('currentResidence')} />
                  ) : (
                    <span className="text-sm">
                      {selectedPerson.currentResidence || (
                        <span className="text-muted-foreground">Not specified</span>
                      )}
                    </span>
                  )}
                </Field>
                <Field label="Place of birth">
                  {isEditing ? (
                    <Input {...form.register('placeOfBirth')} />
                  ) : (
                    <span className="text-sm">
                      {selectedPerson.placeOfBirth || (
                        <span className="text-muted-foreground">Not specified</span>
                      )}
                    </span>
                  )}
                </Field>

                <Field label="Occupation">
                  {isEditing ? (
                    <Input {...form.register('occupation')} />
                  ) : (
                    <span className="text-sm">
                      {selectedPerson.occupation || (
                        <span className="text-muted-foreground">Not specified</span>
                      )}
                    </span>
                  )}
                </Field>

                <Field label="Notes">
                  {isEditing ? (
                    <textarea
                      {...form.register('notes')}
                      className="min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                    />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">
                      {selectedPerson.notes || (
                        <span className="text-muted-foreground">No notes</span>
                      )}
                    </p>
                  )}
                </Field>

                {isEditing && (
                  <>
                    <Field label="Index person">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          {...form.register('isIndexPerson')}
                          className="h-4 w-4"
                        />
                        Mark as the index person on the canvas
                      </label>
                    </Field>

                    <Field label="Pregnancy / loss">
                      <Controller
                        control={form.control}
                        name="pregnancyStatus"
                        render={({ field }) => (
                          <Select
                            value={field.value ?? 'none'}
                            onValueChange={(v) =>
                              field.onChange(
                                v === 'none' ? undefined : (v as PersonFormValues['pregnancyStatus'])
                              )
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              <SelectItem value="pregnancy">Pregnancy</SelectItem>
                              <SelectItem value="miscarriage">Miscarriage</SelectItem>
                              <SelectItem value="stillbirth">Stillbirth</SelectItem>
                              <SelectItem value="abortion">Abortion</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </Field>
                  </>
                )}
              </TabsContent>

              {/* CULTURAL */}
              <TabsContent value="cultural" className="space-y-4">
                <Field label="Mob / Nation">
                  {isEditing ? (
                    <Input {...form.register('mobNation')} />
                  ) : (
                    <span className="text-sm">
                      {selectedPerson.mobNation || (
                        <span className="text-muted-foreground">Not specified</span>
                      )}
                    </span>
                  )}
                </Field>
                <Field label="Language group">
                  {isEditing ? (
                    <Input {...form.register('languageGroup')} />
                  ) : (
                    <span className="text-sm">
                      {selectedPerson.languageGroup || (
                        <span className="text-muted-foreground">Not specified</span>
                      )}
                    </span>
                  )}
                </Field>
                <Field label="Indigenous heritage">
                  {isEditing ? (
                    <Input {...form.register('indigenousHeritage')} />
                  ) : (
                    <span className="text-sm">
                      {selectedPerson.indigenousHeritage || (
                        <span className="text-muted-foreground">Not specified</span>
                      )}
                    </span>
                  )}
                </Field>
                <Field label="Tribal affiliation">
                  <Controller
                    control={form.control}
                    name="tribalAffiliation"
                    render={({ field }) => (
                      <ChipInput
                        value={field.value ?? []}
                        onChange={field.onChange}
                        readOnly={!isEditing}
                        placeholder="Add affiliation and press Enter"
                      />
                    )}
                  />
                </Field>
                <Field label="Cultural identity">
                  <Controller
                    control={form.control}
                    name="culturalIdentity"
                    render={({ field }) => (
                      <ChipInput
                        value={field.value ?? []}
                        onChange={field.onChange}
                        readOnly={!isEditing}
                        placeholder="Add identity and press Enter"
                      />
                    )}
                  />
                </Field>
              </TabsContent>

              {/* MEDICAL */}
              <TabsContent value="medical" className="space-y-4">
                <Field label="Risk indicators">
                  <Controller
                    control={form.control}
                    name="riskIndicators"
                    render={({ field }) => (
                      <ChipInput
                        value={field.value ?? []}
                        onChange={field.onChange}
                        readOnly={!isEditing}
                        placeholder="e.g. domestic violence"
                      />
                    )}
                  />
                </Field>
                <Field label="Medical conditions">
                  <Controller
                    control={form.control}
                    name="medicalConditions"
                    render={({ field }) => (
                      <ChipInput
                        value={field.value ?? []}
                        onChange={field.onChange}
                        readOnly={!isEditing}
                        placeholder="e.g. diabetes"
                      />
                    )}
                  />
                </Field>
                <Field label="Mental health">
                  <Controller
                    control={form.control}
                    name="mentalHealthConditions"
                    render={({ field }) => (
                      <ChipInput
                        value={field.value ?? []}
                        onChange={field.onChange}
                        readOnly={!isEditing}
                        placeholder="e.g. anxiety"
                      />
                    )}
                  />
                </Field>
                <Field label="Substance use">
                  <Controller
                    control={form.control}
                    name="substanceUse"
                    render={({ field }) => (
                      <SubstanceUseList
                        value={field.value ?? []}
                        onChange={field.onChange}
                        readOnly={!isEditing}
                      />
                    )}
                  />
                </Field>
                <Field label="Case notes">
                  <Controller
                    control={form.control}
                    name="caseNotes"
                    render={({ field }) => (
                      <CaseNoteList
                        value={field.value ?? []}
                        onChange={field.onChange}
                        readOnly={!isEditing}
                      />
                    )}
                  />
                </Field>
              </TabsContent>

              {/* FAMILY */}
              <TabsContent value="family" className="space-y-3 text-sm">
                <FamilyRow
                  label="Biological mother"
                  person={mother}
                  onSelect={setSelectedPerson}
                />
                <FamilyRow
                  label="Biological father"
                  person={father}
                  onSelect={setSelectedPerson}
                />
                <FamilyRow
                  label="Primary carer"
                  person={primaryCarer}
                  onSelect={setSelectedPerson}
                />

                <FamilyList
                  label="Siblings"
                  people={siblings}
                  onSelect={setSelectedPerson}
                />
                <FamilyList
                  label="Partners"
                  people={partners}
                  onSelect={setSelectedPerson}
                />
              </TabsContent>
            </Tabs>
          </form>
        </CardContent>
      </Card>
    </aside>
  );
}

interface FieldProps {
  label: string;
  error?: string;
  children: React.ReactNode;
}

function Field({ label, error, children }: FieldProps) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function FamilyRow({
  label,
  person,
  onSelect,
}: {
  label: string;
  person: Person | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right">
        {person ? (
          <PersonLink person={person} onSelect={onSelect} />
        ) : (
          <span className="text-muted-foreground">Not recorded</span>
        )}
      </span>
    </div>
  );
}

function FamilyList({
  label,
  people,
  onSelect,
}: {
  label: string;
  people: Person[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {people.length === 0 ? (
        <div className="text-sm text-muted-foreground">None recorded</div>
      ) : (
        <ul className="ml-4 list-disc">
          {people.map((p) => (
            <li key={p.id}>
              <PersonLink person={p} onSelect={onSelect} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
