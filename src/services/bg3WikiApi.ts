export interface WikiItem {
  name: string;
  rarity?: string;
  uuid?: string;
  description?: string;
  where_to_find?: string;
  act?: number; // Act 1, 2, or 3
}

interface SearchResponse {
  query?: {
    search?: Array<{
      title: string;
      snippet: string;
    }>;
  };
}

interface PageContentResponse {
  query?: {
    pages?: {
      [key: string]: {
        title: string;
        revisions?: Array<{
          slots?: {
            main?: {
              content?: string;
              "*"?: string;
            };
          };
          content?: string; // Fallback for older API format
        }>;
      };
    };
  };
}

interface ParseResponse {
  parse?: {
    title?: string;
    pageid?: number;
    text?: {
      "*"?: string;
    };
  };
  error?: {
    code?: string;
    info?: string;
  };
}

const API_BASE = 'https://bg3.wiki/w/api.php';

/**
 * Check if page content represents an equippable item
 * Based on actual BG3 wiki structure with templates like {{WeaponPage}}, {{ItemPage}}, {{ArmorPage}}
 * Made more flexible to catch all item types
 */
function isEquippableItem(content: string): boolean {
  if (!content || content.trim().length === 0) {
    return false;
  }
  
  // Check for item-related page templates (actual BG3 wiki format)
  // More flexible matching - check for any template starting with item/weapon/armor keywords
  const itemTemplatePatterns = [
    /\{\{\s*weapon/i,
    /\{\{\s*item/i,
    /\{\{\s*armor/i,
    /\{\{\s*helmet/i,
    /\{\{\s*boot/i,
    /\{\{\s*glove/i,
    /\{\{\s*ring/i,
    /\{\{\s*amulet/i,
    /\{\{\s*cloak/i,
    /\{\{\s*shield/i,
    /\{\{\s*accessory/i,
    /\{\{\s*clothing/i,
    /\{\{\s*robe/i,
  ];
  
  // Check for item-related categories (more flexible matching)
  const itemCategoryPatterns = [
    /\[\[category:\s*items?/i,
    /\[\[category:\s*weapons?/i,
    /\[\[category:\s*armor/i,
    /\[\[category:\s*equipment/i,
    /\[\[category:\s*accessories?/i,
    /\[\[category:\s*rings?/i,
    /\[\[category:\s*amulets?/i,
    /\[\[category:\s*helmets?/i,
    /\[\[category:\s*boots?/i,
    /\[\[category:\s*gloves?/i,
    /\[\[category:\s*shields?/i,
    /\[\[category:\s*cloaks?/i,
  ];
  
  // Check if content has item-related template (primary indicator)
  const hasItemTemplate = itemTemplatePatterns.some(pattern => 
    pattern.test(content)
  );
  
  // Check if content has item-related category
  const hasItemCategory = itemCategoryPatterns.some(pattern => 
    pattern.test(content)
  );
  
  // Check for UUID field (all equippable items in BG3 have UUIDs)
  const hasUuid = /\|\s*uuid\s*=/i.test(content);
  
  // Check for uid field (alternative identifier)
  const hasUid = /\|\s*uid\s*=/i.test(content);
  
  // Check for common item fields that indicate it's an equippable item
  const hasItemFields = /\|\s*(rarity|damage|enchantment|type|category)\s*=/i.test(content);
  
  // An item is equippable if it has:
  // - An item page template (strongest indicator), OR
  // - An item category, OR
  // - (UUID or UID) AND item-related fields (rarity, damage, etc.)
  // This makes it more lenient to catch all item types
  return hasItemTemplate || hasItemCategory || ((hasUuid || hasUid) && hasItemFields);
}

/**
 * Extract section content from rendered HTML by anchor ID
 * Searches for <span> elements with id matching the anchor (e.g., id="Where_to_find")
 * MediaWiki structure: <h2><span class="mw-headline" id="Where_to_find">Where to find</span></h2>
 */
function extractSectionFromHTML(html: string, anchorId: string): string | null {
  if (!html) return null;
  
  // Create a temporary DOM parser (works in browser environment)
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Try different ID formats
  const idVariations = [
    anchorId.toLowerCase().replace(/\s+/g, '_'),
    anchorId.replace(/\s+/g, '_'),
    anchorId.toLowerCase(),
    anchorId,
    anchorId.replace(/\s+/g, '-'),
    anchorId.toLowerCase().replace(/\s+/g, '-'),
  ];
  
  let targetSpan: Element | null = null;
  
  for (const id of idVariations) {
    targetSpan = doc.querySelector(`span[id="${id}"]`);
    if (targetSpan) break;
  }
  
  if (!targetSpan) {
    return null;
  }
  
  // Find the parent heading (h2, h3, etc.)
  let heading = targetSpan.parentElement;
  while (heading && !heading.tagName.match(/^H[1-6]$/)) {
    heading = heading.parentElement;
  }
  
  if (!heading) {
    return null;
  }
  
  // Collect content from the heading's next siblings until the next heading
  const contentParts: string[] = [];
  let current: Element | null = heading.nextElementSibling;
  
  while (current) {
    // Stop if we hit another heading
    if (current.tagName.match(/^H[1-6]$/)) {
      break;
    }
    
    // Get text content, excluding edit links and navigation
    const text = current.textContent || '';
    if (text.trim() && !text.match(/^\[edit\]$/i)) {
      contentParts.push(text.trim());
    }
    
    current = current.nextElementSibling;
  }
  
  if (contentParts.length === 0) {
    return null;
  }
  
  // Join and clean up the content
  return contentParts
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/\[edit\]/gi, '')
    .trim();
}

/**
 * Known location to Act mapping
 * This is a fallback for common locations
 */
const LOCATION_TO_ACT: { [key: string]: number } = {
  // Act 1 locations
  'Emerald Grove': 1,
  'Druid Grove': 1,
  'Grove': 1,
  'The Hollow': 1,
  'Hollow': 1,
  'Shattered Sanctum': 1,
  'Goblin Camp': 1,
  'Blighted Village': 1,
  'Waukeen\'s Rest': 1,
  'Risen Road': 1,
  'Mountain Pass': 1,
  'Underdark': 1,
  'The Underdark': 1,
  'Grymforge': 1,
  'Creche Y\'llek': 1,
  'Rosymorn Monastery': 1,
  'Rosymorn Monastery Trail': 1,
  'Arcane Tower': 1,
  'Myconid Colony': 1,
  'Ebonlake Grotto': 1,
  'Adamantine Forge': 1,
  'Sussur Tree': 1,
  'Selûnite Outpost': 1,
  'Decrepit Village': 1,
  'Festering Cove': 1,
  'Beach': 1,
  'Nautiloid': 1,
  'Ravaged Beach': 1,
  'Overgrown Ruins': 1,
  'Roadside Cliffs': 1,
  'Dank Crypt': 1,
  'Defiled Temple': 1,
  
  // Act 2 locations
  'Shadow-Cursed Lands': 2,
  'Last Light Inn': 2,
  'Moonrise Towers': 2,
  'Reithwin Town': 2,
  'House of Healing': 2,
  'Gauntlet of Shar': 2,
  'Thorm Mausoleum': 2,
  'Temple of Shar': 2,
  'Grand Mausoleum': 2,
  'Ketheric Thorm': 2,
  'Shadowfell': 2,
  'Ruined Battlefield': 2,
  
  // Act 3 locations
  'Baldur\'s Gate': 3,
  'Rivington': 3,
  'Wyrm\'s Crossing': 3,
  'Lower City': 3,
  'Upper City': 3,
  'Crimson Palace': 3,
  'House of Hope': 3,
  'Cazador\'s Palace': 3,
  'Sorcerous Sundries': 3,
  'Temple of Bhaal': 3,
  'High Hall': 3,
  'Cloister of Somber Embrace': 3,
  'Cloister': 3,
  'Somber Embrace': 3,
  'Szarr Palace': 3,
  'Murder Tribunal': 3,
  'Forge of the Nine': 3,
  'Wyrm\'s Rock Fortress': 3,
  'Highberry\'s Home': 3,
};

/**
 * Extract location names from location text
 * Tries to identify location names from patterns like "Location Name - details"
 */
function extractLocationNames(locationText: string): string[] {
  if (!locationText) return [];
  
  const locations: string[] = [];
  
  // Split by common separators
  const parts = locationText.split(/[|,;]/).map(p => p.trim());
  
  for (const part of parts) {
    // Try multiple patterns to extract location name
    // Pattern 1: "Location Name - details" or "Location Name: details"
    let match = part.match(/^([^-:]+?)(?:\s*[-:]\s*|(?:\s+in\s+|\s+at\s+))/i);
    if (match) {
      const locationName = match[1].trim();
      if (locationName.length > 2) {
        locations.push(locationName);
        // Also try without "The" prefix if present
        if (locationName.toLowerCase().startsWith('the ')) {
          locations.push(locationName.substring(4).trim());
        }
      }
    }
    
    // Pattern 2: Look for location names in the middle of text (e.g., "Found in Underdark")
    const inMatch = part.match(/\b(in|at|within|inside|near|around)\s+([A-Z][a-zA-Z\s]+?)(?:\s|$|,|\.|;)/i);
    if (inMatch) {
      const locationName = inMatch[2].trim();
      if (locationName.length > 2 && !locationName.toLowerCase().includes('found')) {
        locations.push(locationName);
        // Also try without "The" prefix
        if (locationName.toLowerCase().startsWith('the ')) {
          locations.push(locationName.substring(4).trim());
        }
      }
    }
    
    // Pattern 3: If no separator found, check if the whole part is a location name
    if (!match && !inMatch) {
      // Remove common words that aren't location names
      const cleaned = part.replace(/\b(found|located|obtained|acquired|purchased|sold|dropped|rewarded)\b/gi, '').trim();
      if (cleaned.length > 2 && !cleaned.toLowerCase().includes('chest') && !cleaned.toLowerCase().includes('vendor')) {
        locations.push(cleaned);
        // Also try without "The" prefix
        if (cleaned.toLowerCase().startsWith('the ')) {
          locations.push(cleaned.substring(4).trim());
        }
      }
    }
  }
  
  return locations;
}

/**
 * Determine Act from location text
 * First tries known location mapping, then attempts to query wiki
 * Exported for testing purposes
 */
export async function determineActFromLocation(locationText: string | undefined): Promise<number | undefined> {
  if (!locationText) {
    console.log('[Act Detection] No location text provided');
    return undefined;
  }
  
  // Normalize the text - remove extra whitespace
  const normalizedText = locationText.trim();
  
  // Debug logging for all location text (temporary for debugging)
  console.log('[Act Detection] Processing location text:', normalizedText);
  
  // First, check for explicit Act mentions in campsite locations
  // Patterns: "Campsite (Act One)", "Campsite (Act Two)", "Campsite (Act 3)", etc.
  const campsiteActMatch = normalizedText.match(/campsite.*?\(act\s*(one|two|three|1|2|3)\)/i);
  if (campsiteActMatch) {
    const actText = campsiteActMatch[1].toLowerCase();
    let actNumber: number | undefined;
    if (actText === 'one' || actText === '1') {
      actNumber = 1;
    } else if (actText === 'two' || actText === '2') {
      actNumber = 2;
    } else if (actText === 'three' || actText === '3') {
      actNumber = 3;
    }
    if (actNumber) {
      console.log('[Act Detection] Found explicit Act in campsite location:', actNumber);
      return actNumber;
    }
  }
  
  // Also try a more general pattern for any "Act X" mention in the location text
  const generalActPattern = /\(act\s*(one|two|three|1|2|3)\)/i;
  const generalMatch = normalizedText.match(generalActPattern);
  if (generalMatch) {
    const actText = generalMatch[1].toLowerCase();
    let actNumber: number | undefined;
    if (actText === 'one' || actText === '1') {
      actNumber = 1;
    } else if (actText === 'two' || actText === '2') {
      actNumber = 2;
    } else if (actText === 'three' || actText === '3') {
      actNumber = 3;
    }
    if (actNumber) {
      console.log('[Act Detection] Found explicit Act number in location:', actNumber);
      return actNumber;
    }
  }
  
  // Extract location names from the text
  const locationNames = extractLocationNames(normalizedText);
  console.log('[Act Detection] Extracted location names:', locationNames);
  
  // First, try known location mapping with extracted names
  for (const locationName of locationNames) {
    // Try exact match
    if (LOCATION_TO_ACT[locationName]) {
      console.log('[Act Detection] Found exact match:', locationName, '-> Act', LOCATION_TO_ACT[locationName]);
      return LOCATION_TO_ACT[locationName];
    }
    
    // Try case-insensitive match
    const lowerLocation = locationName.toLowerCase().trim();
    for (const [knownLocation, act] of Object.entries(LOCATION_TO_ACT)) {
      if (knownLocation.toLowerCase() === lowerLocation) {
        console.log('[Act Detection] Found case-insensitive match:', locationName, '-> Act', act);
        return act;
      }
    }
    
    // Try partial match (e.g., "Emerald Grove area" matches "Emerald Grove")
    for (const [knownLocation, act] of Object.entries(LOCATION_TO_ACT)) {
      const lowerKnown = knownLocation.toLowerCase();
      // Check if location contains known location or vice versa
      if (lowerLocation.includes(lowerKnown) || lowerKnown.includes(lowerLocation)) {
        console.log('[Act Detection] Found partial match:', locationName, '-> Act', act);
        return act;
      }
      // Also try matching without "The" prefix
      const locationWithoutThe = lowerLocation.replace(/^the\s+/, '').trim();
      const knownWithoutThe = lowerKnown.replace(/^the\s+/, '').trim();
      if (locationWithoutThe && knownWithoutThe && 
          (locationWithoutThe.includes(knownWithoutThe) || knownWithoutThe.includes(locationWithoutThe))) {
        console.log('[Act Detection] Found match without "The" prefix:', locationName, '-> Act', act);
        return act;
      }
    }
  }
  
  // Last resort: search the entire location text for known location names
  const lowerText = normalizedText.toLowerCase();
  console.log('[Act Detection] Searching full text for location matches:', lowerText);
  
  // First, try exact location name matches
  for (const [knownLocation, act] of Object.entries(LOCATION_TO_ACT)) {
    const lowerKnown = knownLocation.toLowerCase();
    // Direct match in text
    if (lowerText.includes(lowerKnown)) {
      console.log('[Act Detection] Found in full text (exact):', knownLocation, '-> Act', act);
      return act;
    }
    // Try without "The" prefix
    const knownWithoutThe = lowerKnown.replace(/^the\s+/, '').trim();
    if (knownWithoutThe && lowerText.includes(knownWithoutThe)) {
      console.log('[Act Detection] Found in full text (without "The"):', knownLocation, '-> Act', act);
      return act;
    }
    // Also try word boundary matching for better accuracy
    const escapedKnown = knownWithoutThe.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const wordBoundaryRegex = new RegExp(`\\b${escapedKnown}\\b`, 'i');
    if (knownWithoutThe && wordBoundaryRegex.test(lowerText)) {
      console.log('[Act Detection] Found in full text (word boundary):', knownLocation, '-> Act', act);
      return act;
    }
  }
  
  // Special handling for common location keywords that might appear in different formats
  // This is a fallback for cases where the location name isn't extracted properly
  const locationKeywords: { [key: string]: number } = {
    'underdark': 1,
    'emerald grove': 1,
    'druid grove': 1,
    'the hollow': 1,
    'hollow': 1,
    'defiled temple': 1,
    'grymforge': 1,
    'mountain pass': 1,
    'shadow-cursed': 2,
    'shadow cursed': 2,
    'shadowfell': 2,
    'ruined battlefield': 2,
    'moonrise': 2,
    'baldur\'s gate': 3,
    'baldurs gate': 3,
    'lower city': 3,
    'upper city': 3,
    'cloister of somber embrace': 3,
    'cloister': 3,
    'somber embrace': 3,
    'szarr palace': 3,
    'murder tribunal': 3,
    'forge of the nine': 3,
    'wyrm\'s rock fortress': 3,
    'wyrms rock fortress': 3,
    'highberry\'s home': 3,
    'highberrys home': 3,
  };
  
  for (const [keyword, act] of Object.entries(locationKeywords)) {
    // Try simple includes first
    if (lowerText.includes(keyword)) {
      console.log('[Act Detection] Found keyword match:', keyword, '-> Act', act);
      return act;
    }
    // Also try word boundary matching for multi-word keywords
    if (keyword.includes(' ')) {
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const keywordRegex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
      if (keywordRegex.test(lowerText)) {
        console.log('[Act Detection] Found keyword match (word boundary):', keyword, '-> Act', act);
        return act;
      }
    }
  }
  
  // Special case: Check for "cloister" and "somber" together (for Cloister of Somber Embrace)
  // This handles cases where the location might be written differently
  if (lowerText.includes('cloister') && lowerText.includes('somber')) {
    console.log('[Act Detection] Found "cloister" and "somber" together -> Act 3');
    return 3;
  }
  
  // If no match found, try to query wiki for location pages
  // This is more expensive, so we'll do it asynchronously and cache results
  // For now, return undefined if we can't determine from known locations
  console.log('[Act Detection] No match found for:', normalizedText);
  return undefined;
}

/**
 * Extract "where to find" information from rendered HTML
 * Uses anchor IDs to find the section
 */
function extractWhereToFindFromHTML(html: string): string | null {
  if (!html) return null;
  
  // Try different possible anchor IDs for "where to find" section
  const possibleAnchors = [
    'Where_to_find',
    'Where_to_Find',
    'where_to_find',
    'Location',
    'location',
    'Locations',
    'locations'
  ];
  
  for (const anchor of possibleAnchors) {
    const content = extractSectionFromHTML(html, anchor);
    if (content && content.length > 10) { // Only return if we got meaningful content
      return content;
    }
  }
  
  return null;
}

/**
 * Remove HTML comments from text
 */
function removeHTMLComments(text: string): string {
  if (!text) return '';
  // Remove HTML comments like <!-- comment -->
  return text.replace(/<!--[\s\S]*?-->/g, '').trim();
}

/**
 * Extract data from wiki text content
 * Based on actual BG3 wiki structure
 */
function parseWikiContent(content: string, title: string): WikiItem {
  const item: WikiItem = { name: title };
  
  // Try to extract rarity (format: |rarity = Common or |rarity=Common)
  const rarityMatch = content.match(/\|\s*rarity\s*=\s*([^\n|}]+)/i);
  if (rarityMatch) {
    // Remove HTML comments, template braces, and clean the rarity value
    let rarity = removeHTMLComments(rarityMatch[1].trim());
    // Remove any trailing template closing braces
    rarity = rarity.replace(/}}+/g, '').trim();
    item.rarity = rarity;
  }
  
  // Try to extract UUID (format: |uuid = c03b08dc-9e1f-46fa-b67f-7136c1ea5fe5)
  const uuidMatch = content.match(/\|\s*uuid\s*=\s*([^\n|}]+)/i);
  if (uuidMatch) {
    // Remove HTML comments, template braces, and clean the UUID value
    let uuid = removeHTMLComments(uuidMatch[1].trim());
    // Remove any trailing template closing braces
    uuid = uuid.replace(/}}+/g, '').trim();
    item.uuid = uuid;
  }
  
  // Try to extract description (format: |description = ...)
  const descMatch = content.match(/\|\s*description\s*=\s*([^\n|}]+)/i);
  if (descMatch) {
    // Remove HTML comments, template braces, and HTML tags from description
    let description = removeHTMLComments(descMatch[1].trim());
    // Remove any trailing template closing braces
    description = description.replace(/}}+/g, '').trim();
    item.description = description.replace(/<[^>]+>/g, '').trim();
  }
  
  // Helper function to extract field value from wiki template
  // Captures everything from = until the next field (| fieldname =) or end of template (}})
  // Properly handles nested templates like {{CharLink|Wyll}}
  function extractFieldValue(content: string, fieldName: string): string | null {
    // Escape special regex characters in field name
    const escapedFieldName = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Create pattern that matches the exact field name (not a substring)
    // Replace spaces with pattern that matches one or more spaces/underscores
    const fieldPattern = escapedFieldName.replace(/\s+/g, '[\\s_]+');
    
    // Match: | [whitespace] fieldname [whitespace] =
    // Important: Use word boundary or ensure fieldname is followed by whitespace and = (not more word chars)
    // This prevents "where to find" from matching "where to find location"
    // Pattern breakdown:
    // - \\|\\s* : pipe followed by optional whitespace
    // - ${fieldPattern} : the field name with flexible spacing
    // - (?=\\s*=) : positive lookahead ensuring whitespace followed by =
    //   This ensures we match the complete field name, not a substring
    const pattern = new RegExp(`\\|\\s*${fieldPattern}\\s*=`, 'i');
    
    const fieldStartMatch = content.match(pattern);
    
    if (!fieldStartMatch) {
      return null;
    }
    
    // Get the position after the = sign
    const startPos = (fieldStartMatch.index || 0) + fieldStartMatch[0].length;
    const remainingContent = content.substring(startPos);
    
    // Track nested template depth to properly handle }} inside templates
    let braceDepth = 0;
    let i = 0;
    let endPos = remainingContent.length;
    
    // Look for the next field or end of template, handling nested templates
    while (i < remainingContent.length) {
      const char = remainingContent[i];
      const nextTwo = remainingContent.substring(i, i + 2);
      
      // Check for opening template {{ (but not if it's part of a field name)
      if (nextTwo === '{{' && (i === 0 || remainingContent[i - 1] === '\n' || remainingContent[i - 1] === ' ' || remainingContent[i - 1] === '|')) {
        braceDepth++;
        i += 2;
        continue;
      }
      
      // Check for closing template }}
      if (nextTwo === '}}') {
        if (braceDepth > 0) {
          // This is closing a nested template
          braceDepth--;
          i += 2;
          continue;
        } else {
          // This is closing the main template - stop here
          endPos = i;
          break;
        }
      }
      
      // Check for next field: | fieldname = (only if we're at top level, braceDepth === 0)
      // A field separator is: | followed by optional whitespace, then field name (letters/underscores/spaces), then = 
      if (char === '|' && braceDepth === 0) {
        // Look ahead to see if this is a field separator
        // Pattern: | [whitespace] fieldname [whitespace] =
        const lookAhead = remainingContent.substring(i);
        // Match: | followed by optional whitespace, field name (starts with letter/underscore), then optional whitespace and =
        const fieldMatch = lookAhead.match(/^\|\s+[a-zA-Z_][a-zA-Z0-9_\s]*\s*=/);
        if (fieldMatch) {
          // Found the next field - stop before the |
          endPos = i;
          break;
        }
      }
      
      i++;
    }
    
    return remainingContent.substring(0, endPos).trim();
  }
  
  // Helper function to clean wiki markup
  // Preserves template calls like {{CharLink|Mizora}} as they provide helpful context
  const cleanWikiText = (text: string): string => {
    if (!text) return '';
    
    let cleaned = text.trim();
    
    // Remove HTML comments first
    cleaned = removeHTMLComments(cleaned);
    
    // Remove HTML tags
    cleaned = cleaned.replace(/<[^>]+>/g, '');
    
    // Convert [[links]] to plain text (extract the link text)
    cleaned = cleaned.replace(/\[\[([^\]]+)\]\]/g, (_match, linkText) => {
      // Handle piped links: [[Link Text|Display Text]] -> Display Text
      const parts = linkText.split('|');
      return parts[parts.length - 1]; // Return the display text or link text
    });
    
    // Keep template calls like {{CharLink|Mizora}} - they provide helpful context
    // Just normalize whitespace around them
    
    // Replace newlines with spaces
    cleaned = cleaned.replace(/\n+/g, ' ');
    
    // Normalize whitespace (but preserve templates)
    cleaned = cleaned.replace(/\s+/g, ' ');
    
    return cleaned.trim();
  };
  
  // Extract all location fields - handle numbered fields (where to find, where to find2, etc.)
  // Find all "where to find location" and "where to find" fields (including numbered variants)
  const locationEntries: Array<{ name?: string; detail?: string; number?: number }> = [];
  
  // Helper to extract with multiple variations
  function extractWithVariations(fieldName: string): string | null {
    return extractFieldValue(content, fieldName) ||
           extractFieldValue(content, fieldName.replace(/\s+/g, '_')) ||
           extractFieldValue(content, fieldName.trim()) ||
           null;
  }
  
  // First, check for base fields (no number)
  // IMPORTANT: Search for "where to find location" FIRST (longer field name)
  // to avoid it being matched by "where to find" pattern
  const baseLocationName = extractWithVariations('where to find location');
  const baseLocationDetail = extractWithVariations('where to find');
  
  if (baseLocationName || baseLocationDetail) {
    locationEntries.push({
      name: baseLocationName ? cleanWikiText(baseLocationName) : undefined,
      detail: baseLocationDetail ? cleanWikiText(baseLocationDetail) : undefined,
      number: 0
    });
  }
  
  // Then check for numbered fields (where to find location2, where to find2, etc.)
  // Note: numbered fields start at 2, not 1
  for (let locationIndex = 2; locationIndex <= 20; locationIndex++) {
    const locationNameField = `where to find location${locationIndex}`;
    const locationDetailField = `where to find${locationIndex}`;
    
    // Search for longer field name first to avoid substring matching issues
    const locationName = extractWithVariations(locationNameField);
    const locationDetail = extractWithVariations(locationDetailField);
    
    // If we found at least one field for this index, add it
    if (locationName || locationDetail) {
      locationEntries.push({
        name: locationName ? cleanWikiText(locationName) : undefined,
        detail: locationDetail ? cleanWikiText(locationDetail) : undefined,
        number: locationIndex
      });
    } else {
      // If we didn't find any fields for this index, check a few more before stopping
      // (in case there's a gap, but stop after 3 consecutive misses)
      let consecutiveMisses = 0;
      for (let checkAhead = locationIndex + 1; checkAhead <= locationIndex + 3 && checkAhead <= 20; checkAhead++) {
        const checkNameField = `where to find location${checkAhead}`;
        const checkDetailField = `where to find${checkAhead}`;
        const checkName = extractWithVariations(checkNameField);
        const checkDetail = extractWithVariations(checkDetailField);
        if (checkName || checkDetail) {
          consecutiveMisses = 0;
          break;
        } else {
          consecutiveMisses++;
        }
      }
      if (consecutiveMisses >= 3) {
        break; // Stop if we've had 3 consecutive misses
      }
    }
  }
  
  // Fallback: if no fields found at all, try simple location field
  if (locationEntries.length === 0) {
    const locationSimple = extractFieldValue(content, 'location');
    if (locationSimple) {
      locationEntries.push({
        detail: cleanWikiText(locationSimple)
      });
    }
  }
  
  // Combine all location entries
  if (locationEntries.length > 0) {
    const locationParts = locationEntries.map((entry) => {
      if (entry.name && entry.detail) {
        return `${entry.name} - ${entry.detail}`;
      } else if (entry.name) {
        return entry.name;
      } else if (entry.detail) {
        return entry.detail;
      }
      return '';
    }).filter(part => part.length > 0);
    
    // Join multiple locations with separator
    item.where_to_find = locationParts.join(' | ');
  }
  
  return item;
}

/**
 * Search for items using standard MediaWiki search API (public, no auth required)
 */
export async function searchItems(query: string): Promise<WikiItem[]> {
  if (!query.trim()) {
    return [];
  }

  const encodedQuery = encodeURIComponent(query);
  
  try {
    // Use standard MediaWiki search API
    const searchUrl = `${API_BASE}?action=query&list=search&srsearch=${encodedQuery}&srnamespace=0&srlimit=20&format=json&origin=*`;
    const searchResponse = await fetch(searchUrl);
    
    if (!searchResponse.ok) {
      throw new Error(`HTTP error! status: ${searchResponse.status}`);
    }
    
    const searchData: SearchResponse = await searchResponse.json();
    const searchResults = searchData.query?.search || [];
    
    if (searchResults.length === 0) {
      return [];
    }
    
    // Filter out obvious non-item pages, but be lenient to catch all potential items
    const itemPages = searchResults.filter(result => {
      const title = result.title.toLowerCase();
      // Exclude obvious non-item pages
      const excludedPatterns = [
        'category:',
        'template:',
        'user:',
        'talk:',
        'help:',
        'file:',
        'media:',
        'special:',
      ];
      
      return !excludedPatterns.some(pattern => title.includes(pattern));
    });
    
    // Get page titles - increase limit to get more results for filtering
    const titles = itemPages.map(page => page.title).slice(0, 15);
    
    if (titles.length === 0) {
      return [];
    }
    
    // Fetch page content for these titles (for item validation)
    const titlesParam = titles.map(t => encodeURIComponent(t)).join('|');
    const contentUrl = `${API_BASE}?action=query&titles=${titlesParam}&prop=revisions&rvprop=content&rvslots=main&format=json&origin=*`;
    const contentResponse = await fetch(contentUrl);
    
    if (!contentResponse.ok) {
      throw new Error(`HTTP error! status: ${contentResponse.status}`);
    }
    
    const contentData: PageContentResponse = await contentResponse.json();
    const pages = contentData.query?.pages || {};
    
    // Parse each page and filter for equippable items only
    // Use action=parse to get rendered HTML for better section extraction
    const items = await Promise.all(
      Object.values(pages).map(async (page): Promise<WikiItem | null> => {
        // Get content from the correct path: revisions[0].slots.main["*"] or revisions[0].content
        const revision = page.revisions?.[0];
        const content = revision?.slots?.main?.["*"] || 
                       revision?.slots?.main?.content || 
                       revision?.content || 
                       '';
        
        // Only process pages that are equippable items
        if (!isEquippableItem(content)) {
          return null;
        }
        
        // Use action=parse to get rendered HTML for better section extraction
        try {
          const encodedTitle = encodeURIComponent(page.title);
          const parseUrl = `${API_BASE}?action=parse&page=${encodedTitle}&prop=text&format=json&formatversion=2&origin=*`;
          console.log(`[Item Parse] ${page.title} - Fetching HTML from:`, parseUrl);
          const parseResponse = await fetch(parseUrl);
          console.log(`[Item Parse] ${page.title} - Response status:`, parseResponse.status, parseResponse.ok);
          
          if (parseResponse.ok) {
            const parseData: ParseResponse = await parseResponse.json();
            const html = parseData.parse?.text?.["*"] || '';
            console.log(`[Item Parse] ${page.title} - HTML length:`, html.length);
            
            // Parse the item with both raw content and HTML
            const item = parseWikiContent(content, page.title);
            console.log(`[Item Parse] ${page.title} - Item parsed, location from raw:`, item.where_to_find);
            
            // Extract "where to find" from HTML if available
            if (html) {
              const whereToFind = extractWhereToFindFromHTML(html);
              console.log(`[Item Parse] ${page.title} - Extracted location from HTML:`, whereToFind);
              if (whereToFind) {
                item.where_to_find = whereToFind;
                // Determine Act from location
                const act = await determineActFromLocation(whereToFind);
                console.log(`[Item Parse] ${page.title} - Determined Act from HTML location:`, act);
                if (act) {
                  item.act = act;
                }
              } else {
                console.log(`[Item Parse] ${page.title} - No location extracted from HTML, using raw location`);
                // If HTML extraction failed, use raw location and determine Act
                if (item.where_to_find) {
                  const act = await determineActFromLocation(item.where_to_find);
                  console.log(`[Item Parse] ${page.title} - Determined Act from raw location (HTML path):`, act);
                  if (act) {
                    item.act = act;
                  }
                }
              }
            } else {
              // No HTML, use raw location and determine Act
              if (item.where_to_find) {
                const act = await determineActFromLocation(item.where_to_find);
                console.log(`[Item Parse] ${page.title} - Determined Act from raw location (no HTML):`, act);
                if (act) {
                  item.act = act;
                }
              }
            }
            
            return item;
          }
        } catch (parseError) {
          console.warn(`Failed to parse HTML for ${page.title}:`, parseError);
        }
        
        // Fallback to original parsing if HTML parse fails
        const item = parseWikiContent(content, page.title);
        console.log(`[Item Parse] ${page.title} - Fallback parsing, location from raw content:`, item.where_to_find);
        // Try to determine Act from location if available
        if (item.where_to_find) {
          const act = await determineActFromLocation(item.where_to_find);
          console.log(`[Item Parse] ${page.title} - Determined Act from fallback:`, act);
          if (act) {
            item.act = act;
          }
        }
        return item;
      })
    );
    
    // Filter out null and invalid items
    const validItems: WikiItem[] = items.filter((item): item is WikiItem => item !== null && !!item.name);
    
    // Sort by relevance (exact matches first)
    return validItems.sort((a, b) => {
      const aExact = a.name.toLowerCase() === query.toLowerCase();
      const bExact = b.name.toLowerCase() === query.toLowerCase();
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      return a.name.localeCompare(b.name);
    });
  } catch (error) {
    console.error('Error searching items:', error);
    return [];
  }
}

/**
 * Get a specific item by exact name match
 */
export async function getItemByName(name: string): Promise<WikiItem | null> {
  const encodedName = encodeURIComponent(name);
  
  try {
    // First, try to get the page directly (for item validation)
    const url = `${API_BASE}?action=query&titles=${encodedName}&prop=revisions&rvprop=content&rvslots=main&format=json&origin=*`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data: PageContentResponse = await response.json();
    const pages = data.query?.pages || {};
    
    // Find the page with matching title (case-insensitive)
    const page = Object.values(pages).find(p => 
      p.title.toLowerCase() === name.toLowerCase()
    );
    
    if (page && page.revisions?.[0]) {
      const revision = page.revisions[0];
      // Get content from the correct path: revisions[0].slots.main["*"] or revisions[0].content
      const content = revision?.slots?.main?.["*"] || 
                     revision?.slots?.main?.content || 
                     revision?.content || 
                     '';
      
      // Only return if it's an equippable item
      if (content && isEquippableItem(content)) {
        const item = parseWikiContent(content, page.title);
        
        // Use action=parse to get rendered HTML for better section extraction
        try {
          const parseUrl = `${API_BASE}?action=parse&page=${encodedName}&prop=text&format=json&formatversion=2&origin=*`;
          const parseResponse = await fetch(parseUrl);
          
          if (parseResponse.ok) {
            const parseData: ParseResponse = await parseResponse.json();
            const html = parseData.parse?.text?.["*"] || '';
            
            // Extract "where to find" from HTML if available
            if (html) {
              const whereToFind = extractWhereToFindFromHTML(html);
              console.log(`[getItemByName] ${name} - Extracted location from HTML:`, whereToFind);
              if (whereToFind) {
                item.where_to_find = whereToFind;
                // Determine Act from location
                const act = await determineActFromLocation(whereToFind);
                console.log(`[getItemByName] ${name} - Determined Act:`, act);
                if (act) {
                  item.act = act;
                }
              } else {
                console.log(`[getItemByName] ${name} - No location extracted from HTML`);
              }
            }
          }
        } catch (parseError) {
          console.warn(`Failed to parse HTML for ${name}:`, parseError);
        }
        
        // Also try to determine Act from location if we have it
        if (item.where_to_find && !item.act) {
          console.log(`[getItemByName] ${name} - Trying Act detection from raw location:`, item.where_to_find);
          const act = await determineActFromLocation(item.where_to_find);
          console.log(`[getItemByName] ${name} - Determined Act from raw location:`, act);
          if (act) {
            item.act = act;
          }
        }
        
        return item;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching item:', error);
    return null;
  }
}
