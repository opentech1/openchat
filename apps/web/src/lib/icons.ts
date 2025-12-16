/**
 * Centralized icon exports from hugeicons-react
 *
 * This file serves as a single source of truth for all icons used in the application.
 * By importing icons through this barrel file, we:
 * 1. Improve tree-shaking effectiveness
 * 2. Reduce duplicate imports across components
 * 3. Make it easy to audit which icons are actually used
 * 4. Enable easier icon library migration in the future
 *
 * Icon names are mapped to maintain backward compatibility with lucide-react exports.
 */

// Alert & Status Icons
export {
  AlertCircleIcon as AlertCircle,
  Triangle01Icon as AlertTriangle,
  Tick01Icon as Check,
  CheckmarkCircle01Icon as CheckCircle,
  HelpCircleIcon as HelpCircle,
  InformationCircleIcon as Info,
  CancelCircleIcon as XCircle,
} from 'hugeicons-react';

// Navigation Icons
export {
  ArrowDown01Icon as ArrowDownIcon,
  ArrowLeft01Icon as ArrowLeft,
  ArrowRight01Icon as ArrowRight,
  ArrowDown01Icon as ChevronDown,
  ArrowDown01Icon as ChevronDownIcon,
  ArrowLeft01Icon as ChevronLeft,
  ArrowRight01Icon as ChevronRight,
  ArrowUp01Icon as ChevronUp,
  LinkSquare01Icon as ExternalLink,
  Home01Icon as Home,
  SidebarLeft01Icon as PanelLeft,
  SidebarRight01Icon as PanelLeftClose,
} from 'hugeicons-react';

// Action Icons
export {
  Copy01Icon as Copy,
  Download01Icon as Download,
  Edit01Icon as Edit,
  Loading01Icon as LoaderIcon,
  Loading02Icon as Loader2,
  Add01Icon as Plus,
  ReloadIcon as RefreshCw,
  FloppyDiskIcon as Save,
  Search01Icon as SearchIcon,
  SentIcon as SendIcon,
  Square01Icon as SquareIcon,
  StopIcon as StopIcon,
  Delete01Icon as Trash,
  Upload01Icon as Upload,
  Cancel01Icon as X,
  Cancel01Icon as XIcon,
} from 'hugeicons-react';

// UI Icons
export {
  AiBrain01Icon as Brain,
  AiBrain01Icon as BrainIcon,
  ViewIcon as Eye,
  ViewOffIcon as EyeOff,
  Image01Icon as Image,
  Menu01Icon as Menu,
  Mic01Icon as Mic,
  MinusSignIcon as Minus,
  MoreHorizontalIcon as MoreHorizontal,
  MoreVerticalIcon as MoreVertical,
  PaintBoardIcon as Palette,
  Settings01Icon as Settings,
  SparklesIcon as Sparkles,
  Video01Icon as Video,
} from 'hugeicons-react';

// Communication Icons
export {
  Mail01Icon as Mail,
  Comment01Icon as MessageSquare,
  CallIcon as Phone,
} from 'hugeicons-react';

// File Icons
export {
  File01Icon as File,
  FileAttachmentIcon as FileText,
  Folder01Icon as Folder,
  Image01Icon as ImageIcon,
  AttachmentIcon as Paperclip,
} from 'hugeicons-react';

// User Icons
export {
  UserIcon as User,
  UserGroupIcon as Users,
} from 'hugeicons-react';

// Brand Icons
export {
  GithubIcon as Github,
} from 'hugeicons-react';

// Theme Icons
export {
  Moon01Icon as Moon,
  Sun01Icon as Sun,
} from 'hugeicons-react';

// Feature Icons
export {
  CloudIcon as Cloud,
  GitBranchIcon as GitBranch,
  FavouriteIcon as Heart,
  Key01Icon as Key,
  Link01Icon as LinkIcon,
  Login01Icon as LogIn,
  Megaphone01Icon as Megaphone,
  Rocket01Icon as Rocket,
  Database01Icon as Server,
  Wrench01Icon as Wrench,
  FlashIcon as Zap,
} from 'hugeicons-react';

// Type exports - HugeiconsProps is the equivalent of LucideProps
export type { HugeiconsProps } from 'hugeicons-react';

// For backward compatibility, create a type alias for LucideIcon
import type { HugeiconsProps, HugeiconsIcon } from 'hugeicons-react';

/**
 * Type alias for backward compatibility with code that references LucideIcon.
 * This type matches the HugeiconsIcon type signature.
 */
export type LucideIcon = HugeiconsIcon;
