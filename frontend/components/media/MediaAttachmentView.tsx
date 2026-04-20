import React from 'react';
import { MediaAttachment } from '../../types';
import { YouTubeEmbed } from './YouTubeEmbed';
import { AudioPlayer } from './AudioPlayer';
import { VideoPlayer } from './VideoPlayer';
import { GifView } from './GifView';
import { ImageGallery } from './ImageGallery';
import { SingleImage } from './SingleImage';
import { DiceCard } from './DiceCard';
import { InfoCard } from './InfoCard';

interface Props {
  attachment: MediaAttachment;
}

export const MediaAttachmentView: React.FC<Props> = ({ attachment }) => {
  switch (attachment.type) {
    case 'youtube':
      return <YouTubeEmbed {...attachment} />;
    case 'audio':
      return <AudioPlayer {...attachment} />;
    case 'video':
      return <VideoPlayer {...attachment} />;
    case 'gif':
      return <GifView {...attachment} />;
    case 'image_gallery':
      return <ImageGallery images={attachment.images} />;
    case 'image':
      return <SingleImage {...attachment} />;
    case 'dice':
      return <DiceCard {...attachment} />;
    case 'card':
      return <InfoCard {...attachment} />;
    default:
      return null;
  }
};
