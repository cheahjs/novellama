import React, { useState } from 'react';
import { Form, Button, Modal } from 'react-bootstrap';

const SystemPromptEditor = ({ initialPrompt = '', onSave }) => {
  const [show, setShow] = useState(false);
  const [prompt, setPrompt] = useState(initialPrompt);

  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  const handleSave = () => {
    onSave(prompt);
    handleClose();
  };

  return (
    <>
      <Button variant="outline-primary" onClick={handleShow} className="mb-3">
        Edit System Prompt
      </Button>

      <Modal show={show} onHide={handleClose} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Translation System Prompt</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Control
              as="textarea"
              rows={10}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter system prompt for translation style and guidelines..."
            />
            <Form.Text className="text-muted">
              Define the translation style, target language, and any specific guidelines for the AI translator.
            </Form.Text>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Save Changes
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default SystemPromptEditor;