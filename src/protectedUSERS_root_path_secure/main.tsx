import React from 'react';
import { createRoot } from 'react-dom/client';
import ThreeBackground from '../components/ThreeBackground';
import ProtectedUsersPage from './ProtectedUsersPage';
import '../styles.css';
import './protected-users.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThreeBackground theme="dark" />
    <ProtectedUsersPage />
  </React.StrictMode>,
);
