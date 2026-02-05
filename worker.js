export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      })
    }

    const url = new URL(request.url)
    const page = url.searchParams.get('page')

    if (!page) {
      return new Response(JSON.stringify({ error: 'Missing page parameter' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }

    const baseUrl = 'https://nikke-goddess-of-victory-international.fandom.com/api.php'
    const headers = { 'User-Agent': 'NikkeDBStoryGen/1.0' }

    try {
      // First, get the list of sections to find the ones we want
      const sectionsUrl = `${baseUrl}?action=parse&page=${encodeURIComponent(page)}&format=json&prop=sections`
      const sectionsResponse = await fetch(sectionsUrl, { headers })
      const sectionsData = await sectionsResponse.json()

      if (sectionsData.error) {
        return new Response(JSON.stringify(sectionsData), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        })
      }

      // Find section indices for Description, Nikke Backstory, Personality, Background, and Story
      // Note: Story section often has subsections - we capture the main Story section and all its subsections
      const targetSections = ['description', 'nikke backstory', 'personality', 'background', 'story']
      const sections = sectionsData.parse?.sections || []
      const sectionIndices = []
      let capturingStorySubsections = false

      for (const section of sections) {
        const sectionName = section.line?.toLowerCase() || ''
        const sectionIndex = section.index

        // Check if this is a target section
        const isTargetSection = targetSections.some((target) => sectionName.includes(target))

        // Check if we're in Story subsections (toclevel > 1 means it's a subsection)
        // Story subsections typically have toclevel 2 or higher
        if (isTargetSection && sectionName.includes('story')) {
          capturingStorySubsections = true
          sectionIndices.push(sectionIndex)
        } else if (capturingStorySubsections && section.toclevel > 1) {
          sectionIndices.push(sectionIndex)
        } else if (capturingStorySubsections && section.toclevel === 1) {
          capturingStorySubsections = false
          if (isTargetSection) {
            sectionIndices.push(sectionIndex)
          }
        } else if (isTargetSection) {
          sectionIndices.push(sectionIndex)
        }
      }

      // If no target sections found, return empty
      if (sectionIndices.length === 0) {
        return new Response(
          JSON.stringify({
            parse: {
              title: sectionsData.parse?.title,
              wikitext: { '*': '' },
              sections: sections
            }
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'public, max-age=3600'
            }
          }
        )
      }

      // Fetch each target section's wikitext
      const sectionTexts = []
      for (const index of sectionIndices) {
        const sectionUrl = `${baseUrl}?action=parse&page=${encodeURIComponent(page)}&format=json&prop=wikitext&section=${index}`
        const sectionResponse = await fetch(sectionUrl, { headers })
        const sectionData = await sectionResponse.json()

        if (sectionData.parse?.wikitext?.['*']) {
          sectionTexts.push(sectionData.parse.wikitext['*'])
        }
      }

      // Combine all section texts
      const combinedText = sectionTexts.join('\n\n')

      return new Response(
        JSON.stringify({
          parse: {
            title: sectionsData.parse?.title,
            wikitext: { '*': combinedText }
          }
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=3600'
          }
        }
      )
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Failed to fetch wiki page', details: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }
  }
}
