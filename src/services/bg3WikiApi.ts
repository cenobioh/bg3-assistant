export interface WikiItem {
  name: string;
  rarity?: string;
  uuid?: string;
  description?: string;
  where_to_find?: string;
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
 * Extract data from wiki text content
 * Based on actual BG3 wiki structure
 */
function parseWikiContent(content: string, title: string): WikiItem {
  const item: WikiItem = { name: title };
  
  // Try to extract rarity (format: |rarity = Common or |rarity=Common)
  const rarityMatch = content.match(/\|\s*rarity\s*=\s*([^\n|]+)/i);
  if (rarityMatch) {
    item.rarity = rarityMatch[1].trim();
  }
  
  // Try to extract UUID (format: |uuid = c03b08dc-9e1f-46fa-b67f-7136c1ea5fe5)
  const uuidMatch = content.match(/\|\s*uuid\s*=\s*([^\n|]+)/i);
  if (uuidMatch) {
    item.uuid = uuidMatch[1].trim();
  }
  
  // Try to extract description (format: |description = ...)
  const descMatch = content.match(/\|\s*description\s*=\s*([^\n|]+)/i);
  if (descMatch) {
    item.description = descMatch[1].trim().replace(/<[^>]+>/g, '');
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
          const parseResponse = await fetch(parseUrl);
          
          if (parseResponse.ok) {
            const parseData: ParseResponse = await parseResponse.json();
            const html = parseData.parse?.text?.["*"] || '';
            
            // Parse the item with both raw content and HTML
            const item = parseWikiContent(content, page.title);
            
            // Extract "where to find" from HTML if available
            if (html) {
              const whereToFind = extractWhereToFindFromHTML(html);
              if (whereToFind) {
                item.where_to_find = whereToFind;
              }
            }
            
            return item;
          }
        } catch (parseError) {
          console.warn(`Failed to parse HTML for ${page.title}:`, parseError);
        }
        
        // Fallback to original parsing if HTML parse fails
        return parseWikiContent(content, page.title);
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
              if (whereToFind) {
                item.where_to_find = whereToFind;
              }
            }
          }
        } catch (parseError) {
          console.warn(`Failed to parse HTML for ${name}:`, parseError);
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
