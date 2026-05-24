import { IngestionService } from './services/ingestion_service';
import prisma from './config/db';

async function main() {
  const playlistUrl = 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8';
  const playlistName = 'Free-TV Public Channels';
  
  console.log(`Starting programmatic ingestion of playlist: ${playlistName}`);
  console.log(`Source URL: ${playlistUrl}`);
  
  try {
    const result = await IngestionService.importPlaylist(playlistUrl, playlistName);
    console.log("Ingestion execution completed!");
    console.log(`Success: ${result.success}`);
    console.log(`New Channels Imported: ${result.importedCount}`);
    console.log(`Details: ${result.message}`);
    
    // Print a quick count of total channels in the database now
    const totalChannels = await prisma.channel.count();
    const totalCategories = await prisma.category.count();
    console.log(`--- Database Summary ---`);
    console.log(`Total Channels: ${totalChannels}`);
    console.log(`Total Categories: ${totalCategories}`);
  } catch (error) {
    console.error("Critical error during ingestion:", error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
