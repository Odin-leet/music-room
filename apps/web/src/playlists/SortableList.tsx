import { closestCenter, DndContext, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ReactNode } from 'react';
import { IoReorderThree } from 'react-icons/io5';

type HandleProps = { label: string };

// A list you reorder by dragging a row's handle (mouse, touch, or keyboard:
// focus the handle, Space, arrows, Space). `onMove(from, to)` gets the
// indexes once it's dropped; the parent decides what that means.
export function SortableList<T>(props: {
  items: T[];
  keyOf: (item: T) => string;
  enabled: boolean;
  onMove: (from: number, to: number) => void;
  renderRow: (item: T, index: number, handle: ReactNode) => ReactNode;
  handleLabel: (item: T) => string;
}) {
  const sensors = useSensors(
    // A few pixels before a drag starts, so a click on the row still plays.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = props.items.map(props.keyOf);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from >= 0 && to >= 0) props.onMove(from, to);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ol className="list">
          {props.items.map((item, index) => (
            <SortableRow key={ids[index]} id={ids[index]} enabled={props.enabled} handle={{ label: props.handleLabel(item) }}>
              {(handle) => props.renderRow(item, index, handle)}
            </SortableRow>
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, enabled, handle, children }: { id: string; enabled: boolean; handle: HandleProps; children: (handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !enabled });
  const style = { transform: CSS.Translate.toString(transform), transition };
  const grip = enabled ? (
    <button type="button" ref={setActivatorNodeRef} className="icon-btn drag-handle" style={{ width: 32, height: 32 }} aria-label={handle.label} title="Drag to reorder" {...attributes} {...listeners}>
      <IoReorderThree size={20} aria-hidden />
    </button>
  ) : null;
  return (
    <li ref={setNodeRef} style={style} className={isDragging ? 'dragging-item' : undefined} data-dragging={isDragging || undefined}>
      {children(grip)}
    </li>
  );
}
