import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user } = useContext(AuthContext);
  useEffect(() => {
    // If user not logged in → cleanup and exit
    if (!user || !user._id) {
      if (socket) {
        socket.close();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    // ✅ Prevent running during Vercel build (server-side)
    if (typeof window === "undefined") return;

    // Create socket connection
    const newSocket = io('https://splitmate-32de.onrender.com', {
      auth: { token: localStorage.getItem('token') }
    });

    newSocket.emit('join-user-room', user._id);

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      newSocket.close();
    };

  }, [user]);


  const joinGroupRoom = (groupId) => {
    if (socket && groupId) {
      socket.emit('join-group-room', groupId);
    }
  };

  const leaveGroupRoom = (groupId) => {
    if (socket && groupId) {
      socket.emit('leave-group-room', groupId);
    }
  };

  const value = {
    socket,
    isConnected,
    joinGroupRoom,
    leaveGroupRoom
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};