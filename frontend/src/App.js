import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Alert, Navbar, Spinner } from 'react-bootstrap';
import TranslationInput from './components/TranslationInput';
import TranslatedContent from './components/TranslatedContent';
import SystemPromptEditor from './components/SystemPromptEditor';
import ReferenceManager from './components/ReferenceManager';
import SettingsDisplay from './components/SettingsDisplay';
import useTranslationAPI from './hooks/useTranslationAPI';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/App.css';

function App() {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [references, setReferences] = useState([]);
  const [translations, setTranslations] = useState([]);
  const [error, setError] = useState(null);
  
  const {
    translateText,
    loadSession,
    saveSession,  // Add this back
    updateSystemPrompt,
    updateReferences,
    isLoading,
    error: apiError,
    settings
  } = useTranslationAPI();

  useEffect(() => {
    // Load saved data on mount
    const loadSavedData = async () => {
      const data = await loadSession();
      if (data) {
        setSystemPrompt(data.systemPrompt);
        setReferences(data.references);
        setTranslations(data.translations);
      }
    };
    loadSavedData();
  }, []);

  useEffect(() => {
    if (apiError) setError(apiError);
  }, [apiError]);

  const handleSystemPromptUpdate = async (newPrompt) => {
    setSystemPrompt(newPrompt);
    await updateSystemPrompt(newPrompt);
  };

  const handleReferencesUpdate = async (newReferences) => {
    setReferences(newReferences);
    await updateReferences(newReferences);
  };

  const handleTranslate = async (text) => {
    const translation = await translateText(text);
    if (translation) {
      const newTranslations = [...translations, { source: text, translation }];
      setTranslations(newTranslations);
      // Update both state and storage
      await saveSession({
        systemPrompt,
        references,
        translations: newTranslations
      });
    }
  };

  return (
    <div className="App d-flex flex-column min-vh-100">
      <Navbar bg="dark" variant="dark" expand="lg" className="mb-4">
        <Container>
          <Navbar.Brand href="#">
            <span role="img" aria-label="llama">🦙</span> Novellama
          </Navbar.Brand>
        </Container>
      </Navbar>

      <Container className="flex-grow-1">
        <Row>
          <Col lg={8} className="mx-auto">
            <h1 className="text-center mb-4">Novel Translator</h1>

            {error && (
              <Alert variant="danger" dismissible>
                {error}
              </Alert>
            )}

            <div className="d-flex mb-3">
              <SystemPromptEditor 
                initialPrompt={systemPrompt}
                onSave={handleSystemPromptUpdate}
              />
              <ReferenceManager 
                initialReferences={references}
                onSave={handleReferencesUpdate}
              />
            </div>

            <SettingsDisplay settings={settings} />

            <TranslationInput 
              onTranslate={handleTranslate}
              isLoading={isLoading}
            />

            <h3 className="mt-4 mb-3">Translations</h3>
            {translations.length === 0 ? (
              <Alert variant="light">
                No translations yet. Enter some text to translate.
              </Alert>
            ) : (
              <div>
                {translations.map((item, index) => (
                  <TranslatedContent
                    key={index}
                    index={translations.length - 1 - index} 
                    source={item.source}
                    translation={item.translation}
                  />
                )).reverse()}
              </div>
            )}
          </Col>
        </Row>
      </Container>

      <footer className="bg-light py-3 mt-5">
        <Container className="text-center text-muted">
          <p className="mb-0">Novellama &copy; {new Date().getFullYear()} - Novel Translation App</p>
        </Container>
      </footer>
    </div>
  );
}

export default App;