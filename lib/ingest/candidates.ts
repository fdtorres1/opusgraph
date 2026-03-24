import type {
  IngestEntityKind,
  IngestIssue,
  JsonObject,
  SourceKey,
} from "@/lib/ingest/domain";

export type CandidateRawPayload = JsonObject;

export type CandidateWarning = IngestIssue & {
  severity: "warning" | "error";
};

export interface SourceIdentity {
  source: SourceKey;
  sourceEntityKind: string;
  sourceId: string;
  sourceUrl?: string;
  canonicalTitle?: string;
  externalIds?: JsonObject;
}

export interface BaseCandidate {
  entityKind: IngestEntityKind;
  sourceIdentity: SourceIdentity;
  rawPayload: CandidateRawPayload;
  warnings: CandidateWarning[];
  extraMetadata?: JsonObject;
}

export interface ComposerCandidate extends BaseCandidate {
  entityKind: "composer";
  displayName: string;
  firstName: string;
  lastName: string;
  birthYear?: number | null;
  deathYear?: number | null;
  genderId?: string | null;
  nationalityCodes?: string[];
  links?: string[];
}

export interface WorkCandidate extends BaseCandidate {
  entityKind: "work";
  title: string;
  composerSourceId?: string;
  composerDisplayName?: string;
  compositionYear?: number | null;
  instrumentationText?: string | null;
  opusNumber?: string | null;
  catalogNumber?: string | null;
  movements?: string[];
  durationText?: string | null;
  publisher?: string | null;
  sources?: string[];
  recordings?: string[];
}

export type IngestCandidate = ComposerCandidate | WorkCandidate;
