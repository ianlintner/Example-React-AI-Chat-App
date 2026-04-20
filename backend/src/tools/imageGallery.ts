import { ToolDefinition, ToolResult } from './index';
import { v4 as uuidv4 } from 'uuid';

interface ShowImageInput {
  url: string;
  alt: string;
  width?: number;
  height?: number;
}

interface ShowImageGalleryInput {
  images: Array<{ url: string; alt: string }>;
}

export const showImageTool: ToolDefinition = {
  name: 'show_image',
  description: 'Display a single image from a URL.',
  input_schema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'Image URL' },
      alt: { type: 'string', description: 'Alt text / caption' },
      width: { type: 'number' },
      height: { type: 'number' },
    },
    required: ['url', 'alt'],
  },
  async execute(input: unknown): Promise<ToolResult> {
    const { url, alt, width, height } = input as ShowImageInput;
    return {
      attachment: { id: uuidv4(), type: 'image', url, alt, width, height },
    };
  },
};

export const showImageGalleryTool: ToolDefinition = {
  name: 'show_image_gallery',
  description:
    'Display a scrollable gallery of images. Pass an array of URL + alt text pairs.',
  input_schema: {
    type: 'object',
    properties: {
      images: {
        type: 'array',
        items: {
          type: 'object',
          properties: { url: { type: 'string' }, alt: { type: 'string' } },
          required: ['url', 'alt'],
        },
        description: 'Images to display',
      },
    },
    required: ['images'],
  },
  async execute(input: unknown): Promise<ToolResult> {
    const { images } = input as ShowImageGalleryInput;
    return {
      attachment: { id: uuidv4(), type: 'image_gallery', images },
    };
  },
};
