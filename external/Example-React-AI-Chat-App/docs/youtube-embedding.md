# YouTube Video Embedding

The YouTube Guru agent can now embed actual YouTube videos directly in chat messages!

## How It Works

### Backend (Agent Configuration)

- The YouTube Guru agent has been updated to use a special markdown-like format for embedding videos
- When a user requests entertainment, the agent responds with embedded YouTube videos using the format:

````
```youtube
VIDEO_ID
TITLE
DURATION
````

```

### Frontend (React Native Implementation)
- Added a `YouTubeEmbed` component that uses `react-native-webview` to display videos
- Created a `parseMessageContent` function that detects YouTube embed blocks in messages
- Videos are rendered with a clean UI showing title, duration, and the video player

## Example Usage

When a user says "Show me an entertaining video right now", the YouTube Guru will respond with something like:

```

🎥 **Here's a hilarious video that's perfect for you right now!**

```youtube
dQw4w9WgXcQ
Rick Astley - Never Gonna Give You Up (Official Video)
3:32
```

This classic never gets old! Sometimes you just need a good rickroll to brighten your day. Rick's dancing and that unforgettable chorus will definitely put a smile on your face! 😄

Want another video? I've got tons more entertainment ready to go!

````

## Features

- **Direct Video Embedding**: Videos play directly in the chat interface
- **Clean UI**: Each video has a header showing the title and duration
- **Fullscreen Support**: Users can watch videos in fullscreen mode
- **No Autoplay**: Videos don't start playing automatically (user-friendly)
- **Mobile Optimized**: Proper WebView configuration for React Native
- **Mixed Content**: Videos can be embedded alongside text in the same message

## Available Video Content

The YouTube Guru has access to a curated collection of:
- Classic internet memes (Rickroll, Keyboard Cat, Dramatic Hamster)
- Viral sensations (David After Dentist, Grumpy Cat, Sneezing Panda)
- Music hits (Gangnam Style, Baby Shark, Chocolate Rain)
- Gaming legends (Leroy Jenkins)
- Feel-good content and animal comedy

## Technical Implementation

### YouTube Embed Component
```typescript
const YouTubeEmbed: React.FC<{ videoId: string; title: string; duration: string }> = ({
  videoId, title, duration
}) => {
  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0&modestbranding=1`;

  return (
    <View style={styles.youtubeContainer}>
      <View style={styles.youtubeHeader}>
        <Text style={styles.youtubeTitle}>🎬 {title}</Text>
        <Text style={styles.youtubeDuration}>⏱️ {duration}</Text>
      </View>
      <WebView
        source={{ uri: embedUrl }}
        style={styles.youtubeWebView}
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        scalesPageToFit
      />
    </View>
  );
};
````

### Message Parsing

The system uses regex to detect YouTube embed blocks:

````typescript
const youtubeRegex = /```youtube\n([^\n]+)\n([^\n]+)\n([^\n]+)\n```/g;
````

This allows for seamless integration of videos within regular text messages, enabling the agent to provide both commentary and embedded videos in a single response.

## User Experience

Users can now:

1. Ask the YouTube Guru for entertainment videos
2. Receive immediate video recommendations with embedded players
3. Watch videos directly in the chat interface
4. Request additional videos for continued entertainment
5. Enjoy a curated selection of proven funny and entertaining content

This feature transforms the YouTube Guru from a simple video recommender into an interactive entertainment companion that delivers actual video content directly in the conversation!
