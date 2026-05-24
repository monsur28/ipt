/// Category model matching the backend Prisma `Category` table.
///
/// Backend response shape:
/// ```json
/// {
///   "id": "uuid",
///   "name": "Football",
///   "slug": "football",
///   "_count": { "channels": 5 }
/// }
/// ```
class Category {
  final String id;
  final String name;
  final String slug;
  final int channelCount;

  const Category({
    required this.id,
    required this.name,
    required this.slug,
    this.channelCount = 0,
  });

  factory Category.fromJson(Map<String, dynamic> json) {
    return Category(
      id: json['id'] as String,
      name: json['name'] as String,
      slug: json['slug'] as String,
      channelCount: json['_count']?['channels'] as int? ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'slug': slug,
      '_count': {'channels': channelCount},
    };
  }
}
