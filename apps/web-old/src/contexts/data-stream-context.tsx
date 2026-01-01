"use client";

import React, {
	createContext,
	useContext,
	useState,
	useMemo,
	useCallback,
	type ReactNode,
	type Dispatch,
	type SetStateAction,
} from "react";

/**
 * Represents a single part of UI data in the stream.
 * Used for streaming data updates across components.
 */
export interface DataUIPart {
	/** The type identifier for this data part */
	type: string;
	/** Optional payload data associated with this part */
	data?: unknown;
}

/**
 * Context value shape for the DataStream provider.
 * Provides access to streaming data and methods to manipulate it.
 */
interface DataStreamContextValue {
	/** Current array of streaming data parts */
	dataStream: DataUIPart[];
	/** Setter function to update the data stream */
	setDataStream: Dispatch<SetStateAction<DataUIPart[]>>;
	/** Clears all data from the stream */
	clearDataStream: () => void;
}

const DataStreamContext = createContext<DataStreamContextValue | null>(null);

/**
 * Provider for managing streaming data across components.
 *
 * This enables features like:
 * - Real-time UI updates during data streaming
 * - Shared access to streaming state across component tree
 * - Centralized stream management with clear/reset capabilities
 *
 * @example
 * ```tsx
 * // Wrap your app or feature with the provider
 * <DataStreamProvider>
 *   <MyStreamingComponent />
 * </DataStreamProvider>
 *
 * // Use the hook in child components
 * function MyStreamingComponent() {
 *   const { dataStream, setDataStream, clearDataStream } = useDataStream();
 *   // ...
 * }
 * ```
 */
export function DataStreamProvider({ children }: { children: ReactNode }) {
	const [dataStream, setDataStream] = useState<DataUIPart[]>([]);

	const clearDataStream = useCallback(() => setDataStream([]), []);

	const value = useMemo<DataStreamContextValue>(
		() => ({ dataStream, setDataStream, clearDataStream }),
		[dataStream, clearDataStream]
	);

	return (
		<DataStreamContext.Provider value={value}>
			{children}
		</DataStreamContext.Provider>
	);
}

/**
 * Hook to access and manipulate the data stream.
 *
 * Must be used within a DataStreamProvider.
 *
 * @returns The data stream context value containing:
 * - `dataStream`: Current array of data parts
 * - `setDataStream`: Function to update the stream
 * - `clearDataStream`: Function to clear all stream data
 *
 * @throws Error if used outside of a DataStreamProvider
 *
 * @example
 * ```tsx
 * function StreamDisplay() {
 *   const { dataStream, clearDataStream } = useDataStream();
 *
 *   return (
 *     <div>
 *       {dataStream.map((part, i) => (
 *         <div key={i}>{part.type}: {JSON.stringify(part.data)}</div>
 *       ))}
 *       <button onClick={clearDataStream}>Clear</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useDataStream(): DataStreamContextValue {
	const context = useContext(DataStreamContext);
	if (!context) {
		throw new Error("useDataStream must be used within a DataStreamProvider");
	}
	return context;
}
