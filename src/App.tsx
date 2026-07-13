import { Routes, Route } from 'react-router-dom';
import { WorkflowListPage } from './pages/WorkflowListPage';
import { WorkflowBuilderPage } from './pages/WorkflowBuilderPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<WorkflowListPage />} />
      <Route path="/builder/:id" element={<WorkflowBuilderPage />} />
    </Routes>
  );
}

export default App
