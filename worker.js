export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    const url = new URL(request.url);
    const page = url.searchParams.get('page');

    if (!page) {
      return new Response(JSON.stringify({ error: 'Missing page parameter' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const baseUrl = 'https://nikke-goddess-of-victory-international.fandom.com/api.php';
    const headers = { 'User-Agent': 'NikkeDBStoryGen/1.0' };

    try {
      // First, get the list of sections to find the ones we want
      const sectionsUrl = `${baseUrl}?action=parse&page=${encodeURIComponent(page)}&format=json&prop=sections`;
      const sectionsResponse = await fetch(sectionsUrl, { headers });
      const sectionsData = await sectionsResponse.json();

      if (sectionsData.error) {
        return new Response(JSON.stringify(sectionsData), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // Find section indices for Description, Nikke Backstory, and Personality
      const targetSections = ['description', 'nikke backstory', 'personality', 'background'];
      const sections = sectionsData.parse?.sections || [];
      const sectionIndices = [];

      for (const section of sections) {
        const sectionName = section.line?.toLowerCase() || '';
        if (targetSections.some(target => sectionName.includes(target))) {
          sectionIndices.push(section.index);
        }
      }

      // If no target sections found, return empty
      if (sectionIndices.length === 0) {
        return new Response(JSON.stringify({ 
          parse: { 
            title: sectionsData.parse?.title,
            wikitext: { '*': '' },
            sections: sections 
          } 
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }

      // Fetch each target section's wikitext
      const sectionTexts = [];
      for (const index of sectionIndices) {
        const sectionUrl = `${baseUrl}?action=parse&page=${encodeURIComponent(page)}&format=json&prop=wikitext&section=${index}`;
        const sectionResponse = await fetch(sectionUrl, { headers });
        const sectionData = await sectionResponse.json();
        
        if (sectionData.parse?.wikitext?.['*']) {
          sectionTexts.push(sectionData.parse.wikitext['*']);
        }
      }

      // Combine all section texts
      const combinedText = sectionTexts.join('\n\n');

      return new Response(JSON.stringify({
        parse: {
          title: sectionsData.parse?.title,
          wikitext: { '*': combinedText }
        }
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Failed to fetch wiki page', details: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};
