import React, { useState } from 'react';
import { Form, Button, Modal, ListGroup } from 'react-bootstrap';

const ReferenceManager = ({ initialReferences = [], onSave }) => {
  const [show, setShow] = useState(false);
  const [references, setReferences] = useState(initialReferences);
  const [newReference, setNewReference] = useState('');

  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  const handleSave = () => {
    onSave(references);
    handleClose();
  };

  const addReference = () => {
    if (newReference.trim()) {
      setReferences([...references, newReference]);
      setNewReference('');
    }
  };

  const removeReference = (index) => {
    setReferences(references.filter((_, i) => i !== index));
  };

  return (
    <>
      <Button variant="outline-secondary" onClick={handleShow} className="mb-3 ms-2">
        Manage References
      </Button>

      <Modal show={show} onHide={handleClose} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Reference Materials</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Add reference materials such as glossaries, wiki pages, or style guides to help with translation.
          </p>
          <Form onSubmit={(e) => {
            e.preventDefault();
            addReference();
          }}>
            <Form.Group className="mb-3 d-flex">
              <Form.Control
                as="textarea"
                rows={3}
                value={newReference}
                onChange={(e) => setNewReference(e.target.value)}
                placeholder="Enter reference material..."
              />
            </Form.Group>
            <Button variant="primary" onClick={addReference} className="mb-3">
              Add Reference
            </Button>
          </Form>
          
          <h5>Current References:</h5>
          {references.length === 0 ? (
            <p className="text-muted">No references added yet</p>
          ) : (
            <ListGroup>
              {references.map((ref, index) => (
                <ListGroup.Item key={index} className="d-flex justify-content-between align-items-center">
                  <div className="text-truncate" style={{ maxWidth: '80%' }}>
                    {ref.length > 100 ? ref.substring(0, 100) + '...' : ref}
                  </div>
                  <Button 
                    variant="outline-danger" 
                    size="sm" 
                    onClick={() => removeReference(index)}
                  >
                    Remove
                  </Button>
                </ListGroup.Item>
              ))}
            </ListGroup>
          )}
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

export default ReferenceManager;