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
  const [sessionId] = useState('default'); // In a real app, generate or use from auth
  const [translations, setTranslations] = useState([]);
  const [systemPrompt, setSystemPrompt] = useState(
    'You are a professional translator. Translate the given text accurately while maintaining the original meaning, tone, and style. Preserve formatting, paragraph breaks, and special characters when possible.'
  );
  const [references, setReferences] = useState([]);
  
  const {
    translateText,
    updateSystemPrompt,
    updateReferences,
    getTranslationContext,
    getSettings,
    isLoading,
    error,
    settings
  } = useTranslationAPI(sessionId);

  useEffect(() => {
    // Load settings
    getSettings();
    
    // Load existing translations
    const loadTranslations = async () => {
      const context = await getTranslationContext();
      setTranslations(context);
    };
    
    loadTranslations();
  }, [getTranslationContext, getSettings]);

  const handleTranslate = async (text) => {
    const result = await translateText(text);
    if (result) {
      setTranslations(prev => [...prev, {
        source: result.source,
        translation: result.translation
      }]);
    }
  };

  const handleSystemPromptUpdate = async (prompt) => {
    const success = await updateSystemPrompt(prompt);
    if (success) {
      setSystemPrompt(prompt);
    }
  };

  const handleReferencesUpdate = async (newReferences) => {
    const success = await updateReferences(newReferences);
    if (success) {
      setReferences(newReferences);
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