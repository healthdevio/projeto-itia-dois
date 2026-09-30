import { useState } from 'react';

import FloatingChatButton from './interface/chat/FloatingChatButton';
import MiniChat from './interface/chat/MiniChat';
import ExpandedChat from './interface/chat/ExpandedChat';

function App() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  const onToggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div>
      {isOpen &&
        (isExpanded ? (
          <ExpandedChat
            isExpanded={isExpanded}
            onToggleExpanded={onToggleExpanded}
          />
        ) : (
          <MiniChat
            isExpanded={isExpanded}
            onToggleExpanded={onToggleExpanded}
          />
        ))}

      <FloatingChatButton isOpen={isOpen} onClick={toggleChat} />
    </div>
  );
}

export default App;
