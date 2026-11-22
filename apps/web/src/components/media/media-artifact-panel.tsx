import { artifactSchema, mediaAttachmentSchema } from '@agent-chat/contract';
import type { z } from 'zod';
import { MediaAttachments } from './media-attachments';

type Artifact = z.infer<typeof artifactSchema>;

/**
 * Renders a `data-artifact` part whose `kind` is `media`. Validation is
 * defensive: malformed / untrusted parts are ignored, never rendered as HTML.
 */
export function MediaArtifactPanel({ part }: { part: unknown }) {
  const parsed = artifactSchema.safeParse(part);
  if (!parsed.success) return null;
  const artifact: Artifact = parsed.data;
  if (artifact.kind !== 'media' || !artifact.attachments) return null;
  const attachments = artifact.attachments.flatMap(value => {
    const media = mediaAttachmentSchema.safeParse(value);
    return media.success ? [media.data] : [];
  });
  if (attachments.length === 0) return null;
  return (
    <section data-testid='media-artifact' aria-label='Attachments'>
      <MediaAttachments attachments={attachments} />
    </section>
  );
}
