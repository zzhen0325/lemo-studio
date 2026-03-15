import InfiniteCanvasEditor from '../../_components/InfiniteCanvasEditor';

interface EditorPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function InfiniteCanvasEditorPage({ params }: EditorPageProps) {
  const { projectId } = await params;
  return <InfiniteCanvasEditor projectId={projectId} />;
}
