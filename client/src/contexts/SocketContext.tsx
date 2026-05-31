import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

interface SocketContextType {
  socket: any | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

interface SocketProviderProps {
  children: React.ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Check backend health to determine connection status
    const checkHealth = async () => {
      try {
        const baseUrl = API_URL.replace('/api', '');
        const response = await axios.get(`${baseUrl}/health`, { timeout: 5000 });
        if (response.data?.success || response.data?.data?.status === 'healthy') {
          setIsConnected(true);
        } else {
          setIsConnected(false);
        }
      } catch {
        // Backend unreachable - still allow app to work in demo mode
        setIsConnected(false);
      }
    };

    checkHealth();

    // Poll health every 30 seconds
    const interval = setInterval(checkHealth, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <SocketContext.Provider value={{ socket: null, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
