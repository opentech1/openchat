"use client";

export default function TestLayout() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 bg-blue-100">
        <h1 className="text-2xl font-bold mb-4">Messages Area</h1>
        <p>This area should be scrollable</p>
        {Array.from({ length: 20 }, (_, i) => (
          <div key={i} className="p-4 mb-2 bg-white rounded">
            Message {i + 1}
          </div>
        ))}
      </div>
      
      <div className="sticky bottom-0 bg-green-100 border-t p-4">
        <h2 className="text-xl font-bold">Input Area</h2>
        <p>This should be glued to the bottom of the screen</p>
        <input 
          type="text" 
          placeholder="Type a message..." 
          className="w-full p-2 border rounded"
        />
      </div>
    </div>
  );
}