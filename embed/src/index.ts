import { ChatWidget, ChatWidgetOptions } from './widget';

declare global {
  interface Window {
    CatHerdingChat?: CatHerdingChatApi;
  }
}

interface CatHerdingChatApi {
  init(options: ChatWidgetOptions): ChatWidget;
  widget?: ChatWidget;
}

const api: CatHerdingChatApi = {
  init(options: ChatWidgetOptions): ChatWidget {
    if (api.widget) {
      api.widget.destroy();
    }
    const w = new ChatWidget(options);
    w.mount();
    api.widget = w;
    return w;
  },
};

if (typeof window !== 'undefined') {
  window.CatHerdingChat = api;
}

export { ChatWidget, api };
export type { ChatWidgetOptions } from './widget';
