static int protected_fd(int fd,int directory,struct stat*out){
 struct stat s;if(fstat(fd,&s)||s.st_uid!=0||(!directory&&s.st_gid!=0)||(s.st_mode&07777)!=0755||!(directory?S_ISDIR(s.st_mode):S_ISREG(s.st_mode))||(!directory&&(s.st_nlink!=1||s.st_size<(off_t)sizeof(struct mach_header_64)||s.st_size>AX_SYSTEM_PEER_MAX_BYTES)))return 0;
 acl_t acl=acl_get_fd_np(fd,ACL_TYPE_EXTENDED);if(!acl)return 0;acl_entry_t entry;int n=acl_get_entry(acl,ACL_FIRST_ENTRY,&entry);int freed=acl_free(acl);if(n!=0||freed)return 0;if(out)*out=s;return 1;
}
