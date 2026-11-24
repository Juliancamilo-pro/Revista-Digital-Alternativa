export type UserRole = 'admin' | 'collaborator' | 'reader';
export type AccountStatus = 'active' | 'pending' | 'suspended';
export type OutletType = 'medio' | 'independiente';
export type DataSaverMode = 'auto' | 'on' | 'off';
export type PoliticalAffiliationChoice = '' | 'no' | 'yes' | 'prefer_not_to_say';
export type CoverLayoutStyle = 'full' | 'compact' | 'overlay';
export type HeaderStyleVariant = 'classic' | 'editorial' | 'minimal';

export type PostType =
  | 'article'
  | 'gallery'
  | 'video'
  | 'audio'
  | 'infographic'
  | 'document'
  | 'livestream';

export type EditorialKind =
  | 'articulo'
  | 'investigacion'
  | 'opinion'
  | 'cronica'
  | 'analisis'
  | 'reportaje'
  | 'multimedia'
  | 'entrevista'
  | 'editorial'
  | 'explicativo'
  | 'datos'
  | 'carta';

export type PostStatus = 'draft' | 'in_review' | 'scheduled' | 'published' | 'unpublished';
export type ModerationMode = 'post' | 'pre';

export interface HomepageSectionConfig {
  id: string;
  type:
    | 'hero'
    | 'featured'
    | 'breaking'
    | 'live'
    | 'most_read'
    | 'opinion'
    | 'series'
    | 'galleries'
    | 'videos'
    | 'audio'
    | 'collaborators'
    | 'categories_feed';
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  enabled: boolean;
  order: number;
}

export interface SiteUiTexts {
  headerEditionBadge?: string;
  headerEditionNumber?: string;
  headerJoinCta?: string;
  dailyStripLabel?: string;
  joinBannerKicker?: string;
  joinBannerTitle?: string;
  joinBannerSubtitle?: string;
  joinBannerCta?: string;
  footerAboutBlurb?: string;
  footerOriginLine?: string;
  footerSectionsTitle?: string;
  footerTransparencyTitle?: string;
  footerNewsletterTitle?: string;
  footerNewsletterSubtitle?: string;
  footerNewsletterCta?: string;
  footerCopyrightNote?: string;
}

export interface SiteConfig {
  siteName: string;
  tagline: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  autoApproveCollaborators: boolean;
  autoPublishCollaborators: boolean;
  allowAnonymousComments: boolean;
  commentModerationMode: ModerationMode;
  blockedWords: string[];
  contactEmail: string;
  aboutText: string;
  howWeWorkText: string;
  sourcesPolicyText: string;
  correctionsPolicyText: string;
  termsText: string;
  privacyText: string;
  authorLiabilityNotice: string;
  socialLinks: {
    twitter?: string;
    instagram?: string;
    youtube?: string;
    facebook?: string;
    telegram?: string;
  };
  heroPostId?: string;
  featuredPostIds: string[];
  homepageSections: HomepageSectionConfig[];
  uiTexts?: SiteUiTexts;
  updatedAt?: unknown;
}

export interface InviteSecret {
  plaintextCode: string;
  codeHash: string;
  active: boolean;
  expiresAt?: unknown;
  updatedAt?: unknown;
  updatedBy: string;
}

export interface AdminActivityLog {
  id: string;
  actorUid: string;
  actorName: string;
  action: string;
  detail: string;
  createdAt?: unknown;
}

export interface UserAccount {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: AccountStatus;
  inviteHash?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CollaboratorPrivacyFlags {
  showInDirectory?: boolean;
  showAvatar?: boolean;
  showBio?: boolean;
  showWebsite?: boolean;
  showSocialTwitter?: boolean;
  showSocialInstagram?: boolean;
  showSocialYoutube?: boolean;
  showPublicEmail?: boolean;
  showLocation?: boolean;
  showTopics?: boolean;
  showJoinDate?: boolean;
  showPostCount?: boolean;
  showProfession?: boolean;
  showJobTitle?: boolean;
  showOrganization?: boolean;
  showCityCountry?: boolean;
  showAge?: boolean;
  showPoliticalAffiliation?: boolean;
  showPoliticalPartyLogo?: boolean;
}

export interface CollaboratorPublic extends CollaboratorPrivacyFlags {
  uid: string;
  name: string;
  outletType: OutletType;
  profession?: string;
  jobTitle?: string;
  organization?: string;
  city?: string;
  country?: string;
  publicAge?: number;
  politicalAffiliation?: PoliticalAffiliationChoice;
  politicalPartyName?: string;
  politicalPartyRole?: string;
  politicalPartyLogoUrl?: string;
  bio?: string;
  avatarUrl?: string;
  coverUrl?: string;
  websiteUrl?: string;
  socialTwitter?: string;
  socialInstagram?: string;
  socialYoutube?: string;
  publicEmail?: string;
  location?: string;
  topics?: string[];
  status: AccountStatus;
  postCount: number;
  inviteHash?: string;
  directoryHidden?: boolean;
  directoryFeatured?: boolean;
  directoryOrder?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CollaboratorSettings extends CollaboratorPrivacyFlags {
  uid: string;
  name: string;
  outletType: OutletType;
  profession?: string;
  jobTitle?: string;
  organization?: string;
  city?: string;
  country?: string;
  birthYear?: number;
  politicalAffiliation?: PoliticalAffiliationChoice;
  politicalPartyName?: string;
  politicalPartyRole?: string;
  politicalPartyLogoUrl?: string;
  politicalConsentAccepted?: boolean;
  politicalConsentAcceptedAt?: string;
  bio?: string;
  avatarUrl?: string;
  coverUrl?: string;
  websiteUrl?: string;
  socialTwitter?: string;
  socialInstagram?: string;
  socialYoutube?: string;
  publicEmail?: string;
  location?: string;
  topics?: string[];
  updatedAt?: unknown;
}

export type AdminIdentityId = 'owner' | 'magazine';

export interface AdminPublicIdentity extends CollaboratorPrivacyFlags {
  id: AdminIdentityId;
  identityType: AdminIdentityId;
  name: string;
  roleTitle?: string;
  outletType: OutletType;
  profession?: string;
  jobTitle?: string;
  organization?: string;
  city?: string;
  country?: string;
  publicAge?: number;
  politicalAffiliation?: PoliticalAffiliationChoice;
  politicalPartyName?: string;
  politicalPartyRole?: string;
  politicalPartyLogoUrl?: string;
  bio?: string;
  avatarUrl?: string;
  coverUrl?: string;
  websiteUrl?: string;
  socialTwitter?: string;
  socialInstagram?: string;
  socialYoutube?: string;
  publicEmail?: string;
  location?: string;
  topics?: string[];
  showInDirectory: boolean;
  updatedAt?: unknown;
}

export interface AdminPrivateIdentity extends CollaboratorPrivacyFlags {
  id: AdminIdentityId;
  identityType: AdminIdentityId;
  name: string;
  roleTitle?: string;
  outletType: OutletType;
  profession?: string;
  jobTitle?: string;
  organization?: string;
  city?: string;
  country?: string;
  birthYear?: number;
  politicalAffiliation?: PoliticalAffiliationChoice;
  politicalPartyName?: string;
  politicalPartyRole?: string;
  politicalPartyLogoUrl?: string;
  politicalConsentAccepted?: boolean;
  politicalConsentAcceptedAt?: string;
  bio?: string;
  avatarUrl?: string;
  coverUrl?: string;
  websiteUrl?: string;
  socialTwitter?: string;
  socialInstagram?: string;
  socialYoutube?: string;
  publicEmail?: string;
  location?: string;
  topics?: string[];
  showInDirectory: boolean;
  updatedAt?: unknown;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
  order: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SeriesItem {
  id: string;
  title: string;
  slug: string;
  description: string;
  coverImage?: string;
  featured: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type ContentBlockType =
  | 'paragraph'
  | 'heading'
  | 'quote'
  | 'image'
  | 'footnote'
  | 'timeline'
  | 'table'
  | 'divider'
  | 'social_embed'
  | 'callout'
  | 'list'
  | 'document'
  | 'columns'
  | 'before_after'
  | 'metrics'
  | 'context_box'
  | 'speaker_quote'
  | 'carousel';

export interface TimelineEntry {
  date: string;
  title: string;
  detail: string;
}

export interface CorrectionEntry {
  date: string;
  note: string;
  editorName: string;
}

export interface SourceReference {
  label: string;
  url?: string;
}

export interface MetricItem {
  value: string;
  label: string;
  detail?: string;
}

export interface ColumnItem {
  title?: string;
  body: string;
}

export interface GalleryItem {
  id: string;
  url: string;
  alt: string;
  caption: string;
  credit: string;
}

export interface MediaChapter {
  id: string;
  timeSec: number;
  label: string;
  description?: string;
}

export interface ContentBlock {
  id: string;
  type: ContentBlockType;
  text?: string;
  level?: 2 | 3 | 4;
  author?: string;
  speakerRole?: string;
  imageUrl?: string;
  imageAlt?: string;
  imageCredit?: string;
  imageCaption?: string;
  footnoteNumber?: number;
  timelineEntries?: TimelineEntry[];
  tableHeaders?: string[];
  tableRows?: string[][];
  tableCaption?: string;
  embedUrl?: string;
  embedPlatform?: string;
  calloutTone?: 'info' | 'key_fact' | 'warning';
  calloutTitle?: string;
  listStyle?: 'unordered' | 'ordered';
  listItems?: string[];
  documentUrl?: string;
  documentTitle?: string;
  documentDescription?: string;
  dividerVariant?: 'line' | 'asterisks' | 'red_rule';
  columns?: ColumnItem[];
  beforeImageUrl?: string;
  afterImageUrl?: string;
  beforeLabel?: string;
  afterLabel?: string;
  metricItems?: MetricItem[];
  carouselItems?: GalleryItem[];
}

export interface Post {
  id: string;
  title: string;
  slug: string;
  subtitle?: string;
  type: PostType;
  editorialKind?: EditorialKind;
  status: PostStatus;
  featured: boolean;
  breaking: boolean;
  pinnedInFeed?: boolean;
  isSample: boolean;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  seriesId?: string;
  seriesTitle?: string;
  tags: string[];
  authorId: string;
  authorProfileId?: string;
  authorIdentityType?: 'owner' | 'magazine' | 'collaborator';
  authorVerified?: boolean;
  authorName: string;
  authorAvatar?: string;
  authorOutletType?: OutletType;
  coverImage?: string;
  coverAlt?: string;
  coverCredit?: string;
  coverLayout?: CoverLayoutStyle;
  headerStyle?: HeaderStyleVariant;
  accentColor?: string;
  paragraphIndent?: boolean;
  showTableOfContents?: boolean;
  blocks: ContentBlock[];
  galleryItems?: GalleryItem[];
  corrections?: CorrectionEntry[];
  keyPoints?: string[];
  sensitiveContent?: boolean;
  sensitiveWarning?: string;
  sources?: SourceReference[];
  seoDescription?: string;
  commentsEnabled?: boolean;
  mediaUrl?: string;
  mediaSourceType?: string;
  mediaChapters?: MediaChapter[];
  mediaTranscript?: string;
  mediaSubtitlesUrl?: string;
  mediaDurationLabel?: string;
  mediaRelatedLinks?: SourceReference[];
  episodeNotes?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  documentTitle?: string;
  audioDurationSec?: number;
  readTimeMinutes: number;
  viewCount: number;
  commentCount: number;
  publishedAt?: unknown;
  scheduledFor?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PostRevision {
  id: string;
  savedAt: string;
  label: string;
  title: string;
  subtitle: string;
  blocks: ContentBlock[];
}

export interface CommentItem {
  id: string;
  postId: string;
  postTitle: string;
  postAuthorId: string;
  parentId?: string;
  authorId?: string;
  authorName: string;
  authorIsAnonymous: boolean;
  authorIsAdmin?: boolean;
  authorProfileId?: string;
  authorAvatar?: string;
  text: string;
  status: 'approved' | 'pending' | 'hidden' | 'spam';
  likesCount: number;
  reportCount: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface NewsletterSubscriber {
  id: string;
  email: string;
  name?: string;
  createdAt?: unknown;
}

export interface ReportRectification {
  id: string;
  type: 'denuncia' | 'rectificacion';
  postId?: string;
  postTitle?: string;
  reporterName: string;
  reporterEmail: string;
  reason: string;
  details: string;
  status: 'pending' | 'reviewed' | 'resolved';
  createdAt?: unknown;
}

export interface BookmarkItem {
  postId: string;
  title: string;
  slug: string;
  coverImage?: string;
  categoryName?: string;
  createdAt?: unknown;
}

export interface AnalyticsEvent {
  id: string;
  postId: string;
  categoryId: string;
  authorId: string;
  contentType: PostType;
  readDurationSec: number;
  referrerSource: string;
  dateKey: string;
  createdAt?: unknown;
}

export interface BlockedCommenter {
  id: string;
  targetUid?: string;
  targetName: string;
  reason?: string;
  createdAt?: unknown;
}
