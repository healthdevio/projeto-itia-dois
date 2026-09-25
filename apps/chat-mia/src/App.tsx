import { useState } from 'react';
import FloatingChatButton from './interface/chat/FloatingChatButton';
import MiniChat from './interface/chat/MiniChat';

function App() {
  const [isOpen, setIsOpen] = useState(false);

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div>
      {isOpen && <MiniChat />}

      <FloatingChatButton isOpen={isOpen} onClick={toggleChat} />
    </div>
  );
}

export default App;
