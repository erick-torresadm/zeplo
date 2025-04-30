"use client";

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { FlowProvider, useFlowContext } from '@/hooks/useFlowContext';
import FlowEditor from '@/components/flow/FlowEditor';

function FlowEditorWrapper() {
  const { id } = useParams();
  const { loadFlow } = useFlowContext();

  useEffect(() => {
    if (id) {
      loadFlow(id as string);
    }
  }, [id, loadFlow]);

  return <FlowEditor />;
}

export default function FlowEditorPage() {
  return (
    <FlowProvider>
      <FlowEditorWrapper />
    </FlowProvider>
  );
} 