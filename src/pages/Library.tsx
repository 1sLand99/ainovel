import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, BookOpen, Download, Clock, FileText, Plus, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface Novel {
  id: string;
  title: string;
  genre: string[];
  word_count: number;
  updated_at: string;
  outline: string | null;
}

const genres = ["全部", "玄幻", "仙侠", "都市", "言情", "科幻", "系统文", "后宫", "无限流", "悬疑", "历史"];

export default function LibraryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [novels, setNovels] = useState<Novel[]>([]);
  const [search, setSearch] = useState("");
  const [filterGenre, setFilterGenre] = useState("全部");
  const [loading, setLoading] = useState(true);
  const [renameTarget, setRenameTarget] = useState<Novel | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Novel | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchNovels = async () => {
      const { data, error } = await supabase
        .from("novels")
        .select("id, title, genre, word_count, updated_at, outline")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) {
        toast({ title: "加载失败", description: error.message, variant: "destructive" });
      } else {
        setNovels(data || []);
      }
      setLoading(false);
    };
    fetchNovels();
  }, [user]);

  const filtered = novels.filter((n) => {
    const matchSearch = n.title.toLowerCase().includes(search.toLowerCase());
    const matchGenre = filterGenre === "全部" || (n.genre && n.genre.includes(filterGenre));
    return matchSearch && matchGenre;
  });

  const exportNovel = async (novel: Novel, format: "txt" | "md") => {
    const { data: chapters } = await supabase
      .from("chapters")
      .select("chapter_number, title, content")
      .eq("novel_id", novel.id)
      .order("chapter_number");

    if (!chapters || chapters.length === 0) {
      toast({ title: "无章节内容", description: "该小说暂无章节可导出", variant: "destructive" });
      return;
    }

    let content = `${novel.title}\n\n`;
    chapters.forEach((ch) => {
      content += format === "md"
        ? `## 第${ch.chapter_number}章 ${ch.title}\n\n${ch.content}\n\n`
        : `第${ch.chapter_number}章 ${ch.title}\n\n${ch.content}\n\n`;
    });

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${novel.title}.${format === "md" ? "md" : "txt"}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRename = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    const { error } = await supabase
      .from("novels")
      .update({ title: renameValue.trim() })
      .eq("id", renameTarget.id);
    if (error) {
      toast({ title: "重命名失败", description: error.message, variant: "destructive" });
    } else {
      setNovels(prev => prev.map(n => n.id === renameTarget.id ? { ...n, title: renameValue.trim() } : n));
      toast({ title: "已重命名" });
    }
    setRenameTarget(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("novels").delete().eq("id", deleteTarget.id);
    if (error) {
      toast({ title: "删除失败", description: error.message, variant: "destructive" });
    } else {
      setNovels(prev => prev.filter(n => n.id !== deleteTarget.id));
      toast({ title: "已删除" });
    }
    setDeleteTarget(null);
  };

  return (
    <div className="p-4 md:p-8 bg-gradient-soft bg-[length:200%_200%] animate-gradient-slow min-h-screen">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="font-serif text-2xl font-bold">我的书库</h1>
        <Button onClick={() => navigate("/generate")}>
          <Plus className="mr-2 h-4 w-4" />
          新建小说
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索小说..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterGenre} onValueChange={setFilterGenre}>
          <SelectTrigger className="w-full md:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {genres.map((g) => (
              <SelectItem key={g} value={g}>{g}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Novels Grid */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-6 w-2/3" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-12 rounded-full" />
                  <Skeleton className="h-5 w-12 rounded-full" />
                </div>
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24">
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-indigo-500/20">
            <BookOpen className="h-12 w-12 text-primary/40" />
          </div>
          <h3 className="mb-2 font-serif text-xl font-bold text-foreground">还没有作品</h3>
          <p className="mb-6 text-muted-foreground">开始你的第一本 AI 小说创作</p>
          <Button onClick={() => navigate("/generate")} size="lg">
            <Plus className="mr-2 h-4 w-4" />
            开始创作
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((novel) => (
            <Card
              key={novel.id}
              className="glass cursor-pointer transition-all duration-300 hover:translate-y-[-4px] hover:shadow-xl hover:glow-purple hover:border-primary/30 relative"
              onClick={() => navigate(`/novel/${novel.id}`)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <h3 className="mb-2 font-serif text-lg font-bold text-foreground truncate flex-1">{novel.title}</h3>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 -mt-1">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onClick={() => { setRenameTarget(novel); setRenameValue(novel.title); }}>
                        <Pencil className="mr-2 h-4 w-4" />重命名
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => exportNovel(novel, "txt")}>
                        <Download className="mr-2 h-4 w-4" />导出 TXT
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => exportNovel(novel, "md")}>
                        <Download className="mr-2 h-4 w-4" />导出 MD
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(novel)}>
                        <Trash2 className="mr-2 h-4 w-4" />删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="mb-3 flex flex-wrap gap-1">
                  {novel.genre?.map((g) => (
                    <Badge key={g} variant="secondary" className="text-xs">{g}</Badge>
                  ))}
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {(novel.word_count || 0).toLocaleString()}字
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(novel.updated_at).toLocaleDateString("zh-CN")}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 重命名 Dialog */}
      <Dialog open={!!renameTarget} onOpenChange={() => setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名小说</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="输入新标题"
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>取消</Button>
            <Button onClick={handleRename}>确定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除《{deleteTarget?.title}》吗？此操作不可撤销，所有章节内容将永久丢失。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
