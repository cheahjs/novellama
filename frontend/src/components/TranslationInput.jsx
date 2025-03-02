import React, { useState } from 'react';
import { Form, Button, Spinner } from 'react-bootstrap';

const TranslationInput = ({ onTranslate, isLoading }) => {
  const [inputText, setInputText] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    
    await onTranslate(inputText);
    setInputText('');
  };

  return (
    <Form onSubmit={handleSubmit} className="mb-4">
      <Form.Group className="mb-3">
        <Form.Control
          as="textarea"
          rows={5}
          placeholder="Enter text to translate..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
        />
      </Form.Group>
      <Button 
        type="submit" 
        variant="primary" 
        disabled={isLoading || !inputText.trim()}
      >
        {isLoading ? (
          <>
            <Spinner animation="border" size="sm" className="me-2" />
            Translating...
          </>
        ) : (
          'Translate'
        )}
      </Button>
    </Form>
  );
};

export default TranslationInput;