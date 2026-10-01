function ChatInput() {
  return (
    <footer className="border-t p-3">
      <input
        type="text"
        placeholder="Digite uma mensagem"
        className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
      />
    </footer>
  );
}

export default ChatInput;
