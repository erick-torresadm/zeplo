/**
 * Testes de UI para verificar se os componentes estão renderizando corretamente
 * Este arquivo pode ser usado com ferramentas como Jest, Testing Library ou Playwright
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FlowEditor } from '@/components/flow/FlowEditor';
import { FlowNode } from '@/components/flow/FlowNode';
import { FlowConnection } from '@/components/flow/FlowConnection';
import { FlowProvider } from '@/hooks/useFlowContext';

// Mock data para os testes
const mockFlow = {
  id: 'test-flow-id',
  name: 'Test Flow',
  description: 'A test flow',
  nodes: [
    {
      id: 'start',
      type: 'start',
      name: 'Start',
      position: { x: 100, y: 100 },
      data: {}
    },
    {
      id: 'message',
      type: 'message',
      name: 'Message',
      position: { x: 300, y: 100 },
      data: {
        content: 'This is a test message',
        delay: 1000
      }
    }
  ],
  connections: [
    {
      id: 'conn1',
      source: 'start',
      target: 'message',
      label: 'Test Connection'
    }
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  isPublished: false
};

// Mock do hook useFlowContext
jest.mock('@/hooks/useFlowContext', () => ({
  useFlowContext: () => ({
    flow: mockFlow,
    loading: false,
    error: null,
    addNode: jest.fn(),
    updateNode: jest.fn(),
    removeNode: jest.fn(),
    addConnection: jest.fn(),
    removeConnection: jest.fn(),
    loadFlow: jest.fn(),
    saveFlow: jest.fn(),
    createNewFlow: jest.fn(),
    publishFlow: jest.fn()
  }),
  FlowProvider: ({ children }) => <div>{children}</div>
}));

describe('Flow UI Components', () => {
  describe('FlowNode Component', () => {
    test('renders a node with correct data', () => {
      const mockNode = mockFlow.nodes[1]; // message node
      const handleNodeClick = jest.fn();
      const handleNodeDrag = jest.fn();

      render(
        <FlowNode
          node={mockNode}
          onNodeClick={handleNodeClick}
          onNodeDrag={handleNodeDrag}
        />
      );

      expect(screen.getByText('Message')).toBeInTheDocument();
      expect(screen.getByText('This is a test message')).toBeInTheDocument();
      expect(screen.getByText('1s delay')).toBeInTheDocument();
    });

    test('calls onNodeClick when clicked', () => {
      const mockNode = mockFlow.nodes[0]; // start node
      const handleNodeClick = jest.fn();
      const handleNodeDrag = jest.fn();

      render(
        <FlowNode
          node={mockNode}
          onNodeClick={handleNodeClick}
          onNodeDrag={handleNodeDrag}
        />
      );

      fireEvent.click(screen.getByText('Start'));
      expect(handleNodeClick).toHaveBeenCalledWith(mockNode);
    });
  });

  describe('FlowConnection Component', () => {
    test('renders a connection between nodes', () => {
      const mockConnection = mockFlow.connections[0];
      
      render(
        <FlowConnection
          connection={mockConnection}
          nodes={mockFlow.nodes}
        />
      );

      // Verificar se o label da conexão está sendo renderizado
      expect(screen.getByText('Test Connection')).toBeInTheDocument();
    });
  });

  describe('FlowEditor Component', () => {
    test('renders the flow editor with nodes and connections', async () => {
      render(
        <FlowProvider>
          <FlowEditor />
        </FlowProvider>
      );

      // Verificar título do flow
      expect(screen.getByText('Test Flow')).toBeInTheDocument();
      
      // Verificar botões de ação
      expect(screen.getByText('Add Node')).toBeInTheDocument();
      expect(screen.getByText('Save')).toBeInTheDocument();
      expect(screen.getByText('Publish')).toBeInTheDocument();
    });

    test('can add a new node', async () => {
      const { addNode } = useFlowContext();
      
      render(
        <FlowProvider>
          <FlowEditor />
        </FlowProvider>
      );

      // Clicar no botão de adicionar node
      fireEvent.click(screen.getByText('Add Node'));
      
      // Clicar para adicionar um message node
      fireEvent.click(screen.getByText('Message'));
      
      // Verificar se a função addNode foi chamada
      await waitFor(() => {
        expect(addNode).toHaveBeenCalled();
      });
    });

    test('can save a flow', async () => {
      const { saveFlow } = useFlowContext();
      
      render(
        <FlowProvider>
          <FlowEditor />
        </FlowProvider>
      );

      // Clicar no botão de salvar
      fireEvent.click(screen.getByText('Save'));
      
      // Verificar se a função saveFlow foi chamada
      await waitFor(() => {
        expect(saveFlow).toHaveBeenCalled();
      });
    });
  });
});

// Exportar os mocks para uso em outros testes
export { mockFlow }; 