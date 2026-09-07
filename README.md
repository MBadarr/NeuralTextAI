# NeuralText AI

NeuralText AI is a text-first NLP workspace for understanding and improving
written content. Users can paste text into a responsive dashboard and receive
useful language insights without uploading files.

The workspace combines automated text analysis with practical writing tools:

- **Text analysis:** word count, sentence count, tokens, reading time, and
  language information.
- **Named Entity Recognition:** identifies people, organizations, locations,
  and dates in text.
- **Writing assistance:** detects common typos, punctuation problems, sentence
  structure issues, and style concerns while the user types.
- **Predictive text:** suggests context-aware words and complete sentence
  continuations.
- **Sentiment analysis:** identifies whether text is positive, negative, or
  neutral.
- **Text summary:** creates a short extractive summary from longer text.
- **Plagiarism comparison:** compares new text with documents already analyzed
  in the workspace.
- **Workspace insights:** provides document history, entity totals, analytics,
  semantic search, and active NLP model information.

The dashboard is designed to be simple and responsive, with sidebar
navigation, desktop expand/minimize behavior, a mobile navigation drawer, and
shared navigation state managed through Zustand. The backend is powered by
FastAPI and spaCy, while the frontend is built with Next.js and Tailwind CSS.
