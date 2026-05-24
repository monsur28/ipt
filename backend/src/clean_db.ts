import prisma from './config/db';

const sportsKeywords = [
  'sport', 'bein', 'espn', 'arena', 'eurosport', 'skysport', 'supersport', 'bt sport', 
  'fox sport', 'nbc sport', 'star sport', 'ten sport', 'willow', 'cricket', 'football', 
  'soccer', 'basketball', 'nba', 'tennis', 'golf', 'fight', 'ufc', 'mma', 'wwe', 'racing', 
  'moto', 'f1', 'formula 1', 'esport', 'athletics', 'snooker', 'olympic', 'wimbledon', 
  'laliga', 'premier', 'cric', 'rugby', 'hockey', 'badminton', 'volleyball', 'baseball', 
  'nfl', 'mlb', 'nhl', 'darts', 'boxing', 'billiard', 'cycling'
];

function isSportsChannel(name: string, categoryName: string): boolean {
  const normName = name.toLowerCase();
  const normCategory = (categoryName || '').toLowerCase();

  // Check category
  if (
    normCategory.includes('sport') || 
    normCategory.includes('football') || 
    normCategory.includes('soccer') || 
    normCategory.includes('cricket') || 
    normCategory.includes('basketball') || 
    normCategory.includes('tennis') || 
    normCategory.includes('racing') || 
    normCategory.includes('fight') || 
    normCategory.includes('esport') ||
    normCategory.includes('athletics')
  ) {
    return true;
  }

  // Check name keywords
  return sportsKeywords.some(keyword => normName.includes(keyword));
}

async function main() {
  console.log("Cleaning database... Restricting to sports-only channels.");
  try {
    const channels = await prisma.channel.findMany({
      include: { streamSources: true }
    });

    console.log(`Analyzing ${channels.length} channels...`);
    let deletedCount = 0;

    for (const channel of channels) {
      if (!isSportsChannel(channel.name, channel.categoryName)) {
        // Delete this channel (cascade will automatically delete stream sources)
        await prisma.channel.delete({
          where: { id: channel.id }
        });
        deletedCount++;
      }
    }

    console.log(`Deleted ${deletedCount} non-sports channels.`);

    // Delete categories that have no channels left
    const categories = await prisma.category.findMany({
      include: { channels: true }
    });

    let deletedCatCount = 0;
    for (const cat of categories) {
      if (cat.channels.length === 0) {
        await prisma.category.delete({
          where: { id: cat.id }
        });
        deletedCatCount++;
      }
    }
    console.log(`Deleted ${deletedCatCount} empty non-sports categories.`);

    const remainingChannels = await prisma.channel.count();
    const remainingCategories = await prisma.category.count();
    console.log(`--- Clean-up Complete ---`);
    console.log(`Remaining Sports Channels: ${remainingChannels}`);
    console.log(`Remaining Sports Categories: ${remainingCategories}`);

  } catch (error) {
    console.error("Clean-up failed:", error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
