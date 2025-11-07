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
    if (user && user._id) {
      // Create socket connection
      const newSocket = 
      // io('http://localhost:8080', {
      io('https://splitmate-32de.onrender.com', {
        auth: {
          token: localStorage.getItem('token')
        }
      });

      // Join user's room for personal notifications
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
    } else {
      // Clean up socket if user logs out
      if (socket) {
        socket.close();
        setSocket(null);
        setIsConnected(false);
      }
    }
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