export type ChatMessage = {
  id: string;
  text: string;
};

export default class ChatManager {
  private static _instance: ChatManager | null = null;
  public messages: ChatMessage[] = [];

  private constructor() {}

  public static get instance(): ChatManager {
    if (!this._instance) {
      this._instance = new ChatManager();
    }
    return this._instance;
  }

  init(messages: ChatMessage[]) {
    this.messages = messages;

    const event = new CustomEvent("init-chat-messages", {
      detail: {
        messages: messages,
      },
    } as any);
    window.dispatchEvent(event);
  }
}
