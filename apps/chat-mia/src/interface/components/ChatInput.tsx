import { useState } from "react";

interface ChatInputProps{
  onSendMessage: (message: string) => void;
}


function ChatInput({ onSendMessage }: ChatInputProps) {
  const [value, setValue] = useState('');

  return (
    <footer className="border-t p-3">
      <input
        type="text"
        placeholder="Digite uma mensagem"
        className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            onSendMessage(value);
            setValue(''); 
          }
        }}
      />
    </footer>
  );
}

export default ChatInput;
