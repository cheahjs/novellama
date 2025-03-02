import React from 'react';
import { Alert } from 'react-bootstrap';

const SettingsDisplay = ({ settings }) => {
  if (!settings) return null;
  
  return (
    <Alert variant="info" className="mb-3">
      <Alert.Heading>Current Settings</Alert.Heading>
      <p className="mb-0">
        <strong>Model:</strong> {settings.modelName}
        <br />
        <strong>Context Size:</strong> {settings.maxMessages} messages 
        or {settings.maxTokens} tokens (whichever is reached first)
      </p>
    </Alert>
  );
};

export default SettingsDisplay;