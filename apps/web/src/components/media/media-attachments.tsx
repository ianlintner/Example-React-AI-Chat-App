import type { ReactNode } from 'react';
import type { MediaAttachment } from '@agent-chat/contract';
import { Music2, Play } from 'lucide-react';

/** Shared card chrome for all media renderers (Instrument Panel tokens). */
export function MediaCard({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <figure
      data-testid='media-card'
      className='overflow-hidden rounded-lg border border-white/10 bg-[#0B0D0F] text-white'
    >
      <figcaption className='flex items-center gap-2 border-b border-white/10 px-3 py-2 text-sm font-medium'>
        <span className='inline-block h-2 w-2 rounded-full bg-[#F5A524]' />
        <span className='truncate'>{title}</span>
      </figcaption>
      <div className='p-3'>{children}</div>
      {footer ? (
        <div className='border-t border-white/10 px-3 py-2 text-xs text-white/60'>
          {footer}
        </div>
      ) : null}
    </figure>
  );
}

/** YouTube: privacy-enhanced no-cookie embed with a click-to-load gate. */
export function YouTubeEmbed({
  attachment,
}: {
  attachment: Extract<MediaAttachment, { type: 'youtube' }>;
}) {
  const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(attachment.videoId)}`;
  return (
    <MediaCard
      title={attachment.title}
      footer={
        <>
          {attachment.channel ?? 'YouTube'}
          {attachment.duration ? ` · ${attachment.duration}` : ''}
        </>
      }
    >
      <a
        data-testid='youtube-embed'
        href={src}
        target='_blank'
        rel='noopener noreferrer nofollow'
        className='group relative block aspect-video overflow-hidden rounded bg-black'
      >
        <img
          src={attachment.thumbnail}
          alt=''
          loading='lazy'
          referrerPolicy='no-referrer'
          className='h-full w-full object-cover opacity-80 transition group-hover:opacity-100'
        />
        <span className='absolute inset-0 grid place-items-center'>
          <span className='grid h-12 w-12 place-items-center rounded-full bg-black/70'>
            <Play className='h-6 w-6 fill-white text-white' />
          </span>
        </span>
      </a>
    </MediaCard>
  );
}

export function VideoPlayer({
  attachment,
}: {
  attachment: Extract<MediaAttachment, { type: 'video' }>;
}) {
  return (
    <MediaCard title={attachment.title}>
      <video
        data-testid='video-player'
        controls
        preload='metadata'
        poster={attachment.poster}
        src={attachment.url}
        className='w-full rounded'
      />
    </MediaCard>
  );
}

export function AudioPlayer({
  attachment,
}: {
  attachment: Extract<MediaAttachment, { type: 'audio' }>;
}) {
  return (
    <MediaCard title={attachment.title} footer={attachment.artist}>
      <div className='flex items-center gap-3'>
        <Music2 className='h-6 w-6 shrink-0 text-[#F5A524]' />
        <audio
          data-testid='audio-player'
          controls
          preload='none'
          src={attachment.url}
          className='min-w-0 flex-1'
        />
      </div>
    </MediaCard>
  );
}

export function SingleImage({
  attachment,
}: {
  attachment: Extract<MediaAttachment, { type: 'image' }>;
}) {
  return (
    <MediaCard title={attachment.alt}>
      <img
        data-testid='single-image'
        src={attachment.url}
        alt={attachment.alt}
        loading='lazy'
        referrerPolicy='no-referrer'
        width={attachment.width}
        height={attachment.height}
        className='max-h-96 w-full rounded object-contain'
      />
    </MediaCard>
  );
}

export function ImageGallery({
  attachment,
}: {
  attachment: Extract<MediaAttachment, { type: 'image_gallery' }>;
}) {
  return (
    <MediaCard title={`Gallery (${attachment.images.length})`}>
      <ul
        data-testid='image-gallery'
        className='grid grid-cols-2 gap-2 sm:grid-cols-3'
      >
        {attachment.images.map((image, index) => (
          <li key={`${image.url}-${index}`}>
            <img
              src={image.url}
              alt={image.alt}
              loading='lazy'
              referrerPolicy='no-referrer'
              className='aspect-square w-full rounded object-cover'
            />
          </li>
        ))}
      </ul>
    </MediaCard>
  );
}

export function GifView({
  attachment,
}: {
  attachment: Extract<MediaAttachment, { type: 'gif' }>;
}) {
  return (
    <MediaCard title={attachment.title ?? 'GIF'}>
      <img
        data-testid='gif-view'
        src={attachment.url}
        alt={attachment.title ?? 'Animated GIF'}
        loading='lazy'
        referrerPolicy='no-referrer'
        width={attachment.width}
        height={attachment.height}
        className='max-h-96 w-full rounded object-contain'
      />
    </MediaCard>
  );
}

export function DiceCard({
  attachment,
}: {
  attachment: Extract<MediaAttachment, { type: 'dice' }>;
}) {
  return (
    <MediaCard
      title={attachment.purpose ?? `Roll ${attachment.notation}`}
      footer={attachment.notation}
    >
      <div
        data-testid='dice-card'
        className='flex flex-wrap items-center gap-2'
      >
        {attachment.rolls.map((roll, index) => (
          <span
            key={`${index}-${roll}`}
            className='grid h-10 w-10 place-items-center rounded border border-white/20 bg-white/5 font-mono text-lg text-[#F5A524]'
          >
            {roll}
          </span>
        ))}
        <span
          className='ml-auto font-mono text-2xl font-semibold'
          aria-label={`Total ${attachment.total}`}
        >
          {attachment.total}
        </span>
      </div>
    </MediaCard>
  );
}

export function InfoCard({
  attachment,
}: {
  attachment: Extract<MediaAttachment, { type: 'card' }>;
}) {
  return (
    <MediaCard title={attachment.title}>
      <div
        data-testid='info-card'
        className='space-y-2'
        style={{
          borderTop: `2px solid ${attachment.accentColor ?? '#F5A524'}`,
        }}
      >
        <p className='text-xs uppercase tracking-wide text-white/50'>
          {attachment.kind}
        </p>
        <dl className='space-y-1'>
          {attachment.fields.map(field => (
            <div
              key={field.label}
              className='flex justify-between gap-4 text-sm'
            >
              <dt className='text-white/60'>{field.label}</dt>
              <dd className='text-right font-medium'>{field.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </MediaCard>
  );
}

/** Dispatches on the contract union; unknown types fail closed. */
export function MediaAttachmentView({
  attachment,
}: {
  attachment: MediaAttachment;
}) {
  switch (attachment.type) {
    case 'youtube':
      return <YouTubeEmbed attachment={attachment} />;
    case 'video':
      return <VideoPlayer attachment={attachment} />;
    case 'audio':
      return <AudioPlayer attachment={attachment} />;
    case 'image':
      return <SingleImage attachment={attachment} />;
    case 'image_gallery':
      return <ImageGallery attachment={attachment} />;
    case 'gif':
      return <GifView attachment={attachment} />;
    case 'dice':
      return <DiceCard attachment={attachment} />;
    case 'card':
      return <InfoCard attachment={attachment} />;
    default:
      return <p data-testid='media-unsupported'>Unsupported media type</p>;
  }
}

export function MediaAttachments({
  attachments,
}: {
  attachments: MediaAttachment[];
}) {
  if (attachments.length === 0) return null;
  return (
    <div data-testid='media-attachments' className='grid gap-3 md:grid-cols-2'>
      {attachments.map((attachment, index) => (
        <MediaAttachmentView
          key={`${attachment.id}-${index}`}
          attachment={attachment}
        />
      ))}
    </div>
  );
}
