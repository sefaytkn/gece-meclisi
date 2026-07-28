import { Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../types";

interface Props {
  messages: ChatMessage[];
  channel: ChatMessage["type"];
  disabled?: boolean;
  className?: string;
  onClose?: () => void;
  onSend: (message: string) => Promise<void>;
}

const channelNames: Record<ChatMessage["type"], string> = {
  LOBBY: "Lobi sohbeti",
  DAY: "Kasaba meydanı",
  VAMPIRE: "Vampir fısıltıları",
  DEAD: "Ölüler meclisi",
  SYSTEM: "Sistem"
};

export function ChatPanel({ messages, channel, disabled, className = "", onClose, onSend }: Props) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!message.trim() || sending) return;
    try {
      setSending(true);
      await onSend(message);
      setMessage("");
      setError("");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Mesaj gönderilemedi.");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className={`panel flex min-h-[420px] flex-col overflow-hidden ${className}`}>
      <div className="flex items-center justify-between border-b border-gold/[.1] px-5 py-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className={channel === "VAMPIRE" ? "text-rose-300" : "text-moon"} />
          <h2 className="text-sm font-semibold">{channelNames[channel]}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-mist">{messages.length} mesaj</span>
          {onClose && (
            <button
              type="button"
              className="btn-icon h-8 w-8 rounded-lg"
              onClick={onClose}
              aria-label="Sohbeti kapat"
              title="Sohbeti kapat"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
      <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto p-5">
        {messages.length === 0 && (
          <div className="grid h-full min-h-52 place-items-center text-center">
            <div>
              <p className="text-sm font-medium text-white">Sessizliği ilk sen boz.</p>
              <p className="mt-1 text-xs text-mist">Mesajlar yalnızca doğru kanaldaki oyunculara ulaşır.</p>
            </div>
          </div>
        )}
        {messages.map((item) =>
          item.isSystem ? (
            <div key={item.id} className="rounded-xl border border-white/[.05] bg-white/[.025] px-3 py-2 text-center text-xs text-mist">{item.message}</div>
          ) : (
            <div key={item.id} className="flex gap-3">
              <div className="avatar h-8 w-8 shrink-0 text-[10px] font-bold">{item.username.slice(0, 2).toUpperCase()}</div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white">{item.username}</span>
                  <span className="text-[10px] text-mist">{new Date(item.sentAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <p className="mt-1 break-words text-sm leading-relaxed text-moon/80">{item.message}</p>
              </div>
            </div>
          )
        )}
        <div ref={endRef} />
      </div>
      <form onSubmit={submit} className="border-t border-gold/[.1] p-4">
        {error && <p className="mb-2 text-xs text-rose-300">{error}</p>}
        <div className="flex gap-2">
          <input
            className="field min-w-0 flex-1"
            value={message}
            onChange={(event) => setMessage(event.target.value.slice(0, 400))}
            placeholder={disabled ? "Bu aşamada sohbet kapalı" : "Bir mesaj yaz..."}
            disabled={disabled || sending}
            aria-label="Sohbet mesajı"
          />
          <button className="btn-icon h-11 w-11 shrink-0 border-ember/30 bg-blood text-bone hover:bg-[#a52435]" disabled={disabled || sending || !message.trim()} aria-label="Mesaj gönder">
            <Send size={17} />
          </button>
        </div>
      </form>
    </section>
  );
}
